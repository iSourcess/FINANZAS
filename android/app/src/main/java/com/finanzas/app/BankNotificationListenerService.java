package com.finanzas.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;

/**
 * BankNotificationListenerService
 *
 * Servicio nativo para escuchar notificaciones de transacciones bancarias:
 *   1. Regla de privacidad: Solo analiza contenido de apps marcadas como bancos.
 *   2. Deduplicación por identificador estable y ventana de 5 minutos.
 *   3. Parseo nativo con DetectionParser (reglas JSON declarativas y modo genérico).
 *   4. Emisión de notificación nativa en el canal "Movimientos detectados" con el formato exacto:
 *      "MOVIMIENTO DETECTADO POR {monto} DE LA CUENTA {banco}".
 *   5. Visibilidad PRIVATE con versión pública genérica para pantalla de bloqueo.
 */
public class BankNotificationListenerService extends NotificationListenerService {

    private static final String TAG = "BankNotifListener";
    public static final String PREFS_NAME = "BankNotificationPrefs";
    public static final String KEY_DETECTION_ENABLED = "notification_detection_enabled";
    public static final String KEY_ALLOWLIST = "allowlist_packages";
    public static final String KEY_SEEN_APPS = "seen_apps_json";
    public static final String KEY_DETECTION_RULES = "detection_rules_json";
    public static final String KEY_GENERIC_OPTIONS = "generic_options_json";
    public static final String KEY_SHOW_AMOUNT = "show_amount_in_notification";
    public static final String KEY_HIDE_AMOUNTS = "hide_amounts"; // Modo privado
    public static final String KEY_BANK_MAPPINGS = "bank_account_mappings_json";

    public static final String QUEUE_FILENAME = "notification_queue.json";
    public static final String PENDING_DETECTIONS_FILENAME = "pending_detections_queue.json";

    public static final String CHANNEL_ID = "movimientos_detectados";
    public static final String CHANNEL_NAME = "Movimientos detectados";

    private static volatile boolean sIsConnected = false;
    private static final Object QUEUE_LOCK = new Object();
    private static final Object DETECTIONS_LOCK = new Object();

    // Caché en memoria para deduplicación rápida de notificaciones repetidas
    private static final Set<String> sRecentKeys = new HashSet<>();
    private static final int MAX_RECENT_KEYS = 200;

    public static boolean isConnected() {
        return sIsConnected;
    }

    public static boolean rebindService(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try {
                requestRebind(new ComponentName(context, BankNotificationListenerService.class));
                return true;
            } catch (Exception e) {
                Log.w(TAG, "No se pudo solicitar requestRebind: " + e.getMessage());
            }
        }
        return false;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel(getApplicationContext());
    }

    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
        sIsConnected = true;
        Log.i(TAG, "NotificationListenerService conectado");
        NotificationDetectionPlugin.onListenerStateChanged(true);
    }

    @Override
    public void onListenerDisconnected() {
        super.onListenerDisconnected();
        sIsConnected = false;
        Log.w(TAG, "NotificationListenerService desconectado por el sistema");
        NotificationDetectionPlugin.onListenerStateChanged(false);

        // Intentar reconectar si Android >= N
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try {
                requestRebind(new ComponentName(this, BankNotificationListenerService.class));
            } catch (Exception ignored) {
            }
        }
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;

        Context context = getApplicationContext();
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        // 1. Verificar si la detección general está encendida
        boolean isDetectionEnabled = prefs.getBoolean(KEY_DETECTION_ENABLED, false);
        if (!isDetectionEnabled) {
            return;
        }

        String packageName = sbn.getPackageName();
        if (packageName == null || packageName.isEmpty()) {
            return;
        }

        // Ignorar notificaciones de nuestra propia app y del sistema básico
        if (packageName.equals(context.getPackageName()) || "android".equals(packageName)) {
            return;
        }

        // Obtener etiqueta legible de la aplicación
        PackageManager pm = getPackageManager();
        String appLabel = packageName;
        try {
            ApplicationInfo ai = pm.getApplicationInfo(packageName, 0);
            CharSequence label = pm.getApplicationLabel(ai);
            if (label != null) {
                appLabel = label.toString();
            }
        } catch (Exception ignored) {
        }

        String nowIso = getNowIso();

        // 2. Obtener lista de apps permitidas (bancos)
        Set<String> allowlist = getAllowlist(prefs);
        boolean isAllowed = allowlist.contains(packageName);

        // Siempre actualizar "Apps vistas" (paquete, etiqueta y última fecha)
        recordSeenApp(prefs, packageName, appLabel, nowIso);

        // 3. REGLA DE PRIVACIDAD:
        // Si NO está permitida, TERMINAR AQUÍ. Jamás leer ni guardar extras/texto de otras apps.
        if (!isAllowed) {
            return;
        }

        // 4. Procesar notificación de app permitida (banco)
        Notification notification = sbn.getNotification();
        if (notification == null) return;

        Bundle extras = notification.extras;
        String title = "";
        String text = "";
        String bigText = "";
        String subText = "";

        if (extras != null) {
            CharSequence titleSeq = extras.getCharSequence(Notification.EXTRA_TITLE);
            if (titleSeq != null) title = titleSeq.toString().trim();

            CharSequence textSeq = extras.getCharSequence(Notification.EXTRA_TEXT);
            if (textSeq != null) text = textSeq.toString().trim();

            CharSequence bigTextSeq = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
            if (bigTextSeq != null) bigText = bigTextSeq.toString().trim();

            CharSequence subTextSeq = extras.getCharSequence(Notification.EXTRA_SUB_TEXT);
            if (subTextSeq != null) subText = subTextSeq.toString().trim();
        }

        // Si no hay texto ni título relevante, descartar
        if (title.isEmpty() && text.isEmpty() && bigText.isEmpty()) {
            return;
        }

        long postTime = sbn.getPostTime();
        if (postTime <= 0) postTime = System.currentTimeMillis();

        // 5. Identificador estable para deduplicar
        String stableId = buildStableId(sbn, title, text, bigText);
        synchronized (sRecentKeys) {
            if (sRecentKeys.contains(stableId)) {
                // Notificación duplicada o actualización idéntica reciente
                return;
            }
            if (sRecentKeys.size() >= MAX_RECENT_KEYS) {
                sRecentKeys.clear();
            }
            sRecentKeys.add(stableId);
        }

        try {
            JSONObject notifObj = new JSONObject();
            notifObj.put("id", stableId);
            notifObj.put("packageName", packageName);
            notifObj.put("appLabel", appLabel);
            notifObj.put("title", title);
            notifObj.put("text", text);
            notifObj.put("bigText", bigText);
            notifObj.put("subText", subText);
            notifObj.put("postTime", postTime);
            notifObj.put("createdAt", nowIso);

            // 6. Guardar muestra en cola persistente para Modo Captura
            enqueueNotification(context, notifObj);

            // 7. Parsear la notificación con el motor nativo DetectionParser
            JSONArray rulesArray = null;
            String rulesStr = prefs.getString(KEY_DETECTION_RULES, null);
            if (rulesStr != null && !rulesStr.isEmpty()) {
                rulesArray = new JSONArray(rulesStr);
            }

            JSONObject genericOptions = null;
            String optsStr = prefs.getString(KEY_GENERIC_OPTIONS, null);
            if (optsStr != null && !optsStr.isEmpty()) {
                genericOptions = new JSONObject(optsStr);
            }

            DetectionParser.ParseResult parseRes = DetectionParser.parseNotification(notifObj, rulesArray, genericOptions);

            // Si es publicidad, promoción o spam -> ignorar por completo
            if (parseRes.ignored) {
                Log.d(TAG, "Notificación ignorada por regla de filtro o promoción");
                return;
            }

            // 8. Crear detección pendiente (sin almacenar el texto original)
            JSONObject pendingDet = new JSONObject();
            pendingDet.put("id", "det_" + stableId);
            pendingDet.put("packageName", packageName);
            pendingDet.put("appLabel", appLabel);
            pendingDet.put("postedAt", nowIso);
            pendingDet.put("detectedAt", nowIso);
            pendingDet.put("amountCents", parseRes.amountCents != null ? parseRes.amountCents : JSONObject.NULL);
            pendingDet.put("currency", parseRes.currency);
            pendingDet.put("kind", parseRes.kind != null ? parseRes.kind : JSONObject.NULL);
            pendingDet.put("merchant", parseRes.merchant != null ? parseRes.merchant : JSONObject.NULL);
            pendingDet.put("last4", parseRes.last4 != null ? parseRes.last4 : JSONObject.NULL);
            pendingDet.put("accountId", JSONObject.NULL); // Se resuelve con cuentas en la web
            pendingDet.put("status", "pending");

            JSONArray sources = new JSONArray();
            JSONObject srcItem = new JSONObject();
            srcItem.put("packageName", packageName);
            srcItem.put("appLabel", appLabel);
            srcItem.put("postTime", postTime);
            srcItem.put("notificationId", stableId);
            sources.put(srcItem);

            pendingDet.put("sources", sources);
            pendingDet.put("duplicateOf", JSONObject.NULL);
            pendingDet.put("matchedFixedId", JSONObject.NULL);
            pendingDet.put("parseConfidence", parseRes.parseConfidence);

            // Guardar detección pendiente en cola nativa
            enqueuePendingDetection(context, pendingDet);

            // 9. Disparar notificación propia en el canal "Movimientos detectados"
            boolean showAmountSetting = prefs.getBoolean(KEY_SHOW_AMOUNT, true);
            boolean privateMode = prefs.getBoolean(KEY_HIDE_AMOUNTS, false);
            boolean showAmount = showAmountSetting && !privateMode;

            String displayText = DetectionParser.formatNotificationDisplayText(
                parseRes.amountCents,
                parseRes.currency,
                appLabel,
                showAmount
            );

            sendNativeMovementNotification(context, displayText, stableId.hashCode());

            // 10. Notificar a la web en tiempo real si está abierta
            NotificationDetectionPlugin.onNativeNotificationReceived(notifObj);
            NotificationDetectionPlugin.onNativeDetectionReceived(pendingDet);

        } catch (Exception e) {
            Log.e(TAG, "Error procesando notificación bancaria permitida: " + e.getMessage(), e);
        }
    }

    private void sendNativeMovementNotification(Context context, String displayText, int notifId) {
        try {
            createNotificationChannel(context);

            Intent deepLinkIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("finanzas://confirmar"), context, MainActivity.class);
            deepLinkIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

            PendingIntent contentPendingIntent = PendingIntent.getActivity(
                context,
                (int) System.currentTimeMillis(),
                deepLinkIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );

            // Versión pública para la pantalla bloqueada (sin exponer saldos ni cuentas)
            Notification publicVersion = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_shortcut_expense)
                .setContentTitle("Finanzas")
                .setContentText("Nuevo movimiento bancario detectado")
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .build();

            // Notificación privada con el texto exacto requerido
            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_shortcut_expense)
                .setContentTitle("Finanzas")
                .setContentText(displayText)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(displayText))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(contentPendingIntent)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setPublicVersion(publicVersion);

            NotificationManagerCompat manager = NotificationManagerCompat.from(context);
            manager.notify(Math.abs(notifId % 100000) + 1000, builder.build());

        } catch (Exception e) {
            Log.e(TAG, "Error emitiendo notificación nativa de movimiento detectado: " + e.getMessage(), e);
        }
    }

    private static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager != null) {
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Avisos de compras, retiros y transferencias bancarias detectadas");
                channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
                manager.createNotificationChannel(channel);
            }
        }
    }

    private String buildStableId(StatusBarNotification sbn, String title, String text, String bigText) {
        String key = sbn.getKey();
        if (key != null && !key.isEmpty()) {
            return sbn.getPackageName() + "#" + key + "#" + Math.abs((title + "|" + text + "|" + bigText).hashCode());
        }
        String tag = sbn.getTag() != null ? sbn.getTag() : "";
        return sbn.getPackageName() + "#" + sbn.getId() + "#" + tag + "#" + Math.abs((title + "|" + text).hashCode());
    }

    private static Set<String> getAllowlist(SharedPreferences prefs) {
        Set<String> set = new HashSet<>();
        String raw = prefs.getString(KEY_ALLOWLIST, null);
        if (raw != null && !raw.isEmpty()) {
            try {
                JSONArray arr = new JSONArray(raw);
                for (int i = 0; i < arr.length(); i++) {
                    String pkg = arr.optString(i);
                    if (pkg != null && !pkg.isEmpty()) {
                        set.add(pkg);
                    }
                }
            } catch (Exception ignored) {
            }
        }
        return set;
    }

    private synchronized void recordSeenApp(SharedPreferences prefs, String packageName, String appLabel, String nowIso) {
        try {
            String rawSeen = prefs.getString(KEY_SEEN_APPS, "{}");
            JSONObject seenObj = new JSONObject(rawSeen);

            JSONObject item = new JSONObject();
            item.put("packageName", packageName);
            item.put("appLabel", appLabel);
            item.put("lastSeenAt", nowIso);

            seenObj.put(packageName, item);
            prefs.edit().putString(KEY_SEEN_APPS, seenObj.toString()).apply();
        } catch (Exception e) {
            Log.w(TAG, "Error al registrar app vista: " + e.getMessage());
        }
    }

    private void enqueueNotification(Context context, JSONObject notifObj) {
        synchronized (QUEUE_LOCK) {
            File file = new File(context.getFilesDir(), QUEUE_FILENAME);
            JSONArray queue = new JSONArray();

            if (file.exists()) {
                try (FileInputStream fis = new FileInputStream(file)) {
                    byte[] data = new byte[(int) file.length()];
                    fis.read(data);
                    String content = new String(data, "UTF-8");
                    queue = new JSONArray(content);
                } catch (Exception e) {
                    queue = new JSONArray();
                }
            }

            String newId = notifObj.optString("id");
            for (int i = 0; i < queue.length(); i++) {
                JSONObject existing = queue.optJSONObject(i);
                if (existing != null && newId.equals(existing.optString("id"))) {
                    return;
                }
            }

            if (queue.length() >= 300) {
                JSONArray trimmed = new JSONArray();
                for (int i = queue.length() - 250; i < queue.length(); i++) {
                    trimmed.put(queue.opt(i));
                }
                queue = trimmed;
            }

            queue.put(notifObj);

            try (FileOutputStream fos = new FileOutputStream(file, false)) {
                fos.write(queue.toString().getBytes("UTF-8"));
                fos.flush();
            } catch (Exception e) {
                Log.e(TAG, "Error escribiendo en cola de notificaciones: " + e.getMessage(), e);
            }
        }
    }

    private void enqueuePendingDetection(Context context, JSONObject detectionObj) {
        synchronized (DETECTIONS_LOCK) {
            File file = new File(context.getFilesDir(), PENDING_DETECTIONS_FILENAME);
            JSONArray list = new JSONArray();

            if (file.exists()) {
                try (FileInputStream fis = new FileInputStream(file)) {
                    byte[] data = new byte[(int) file.length()];
                    fis.read(data);
                    list = new JSONArray(new String(data, "UTF-8"));
                } catch (Exception e) {
                    list = new JSONArray();
                }
            }

            list.put(detectionObj);

            try (FileOutputStream fos = new FileOutputStream(file, false)) {
                fos.write(list.toString().getBytes("UTF-8"));
                fos.flush();
            } catch (Exception e) {
                Log.e(TAG, "Error escribiendo detecciones pendientes: " + e.getMessage(), e);
            }
        }
    }

    public static JSONArray drainQueueStatic(Context context) {
        synchronized (QUEUE_LOCK) {
            File file = new File(context.getFilesDir(), QUEUE_FILENAME);
            if (!file.exists()) return new JSONArray();

            try (FileInputStream fis = new FileInputStream(file)) {
                byte[] data = new byte[(int) file.length()];
                fis.read(data);
                JSONArray result = new JSONArray(new String(data, "UTF-8"));
                file.delete();
                return result;
            } catch (Exception e) {
                file.delete();
                return new JSONArray();
            }
        }
    }

    public static JSONArray drainPendingDetectionsStatic(Context context) {
        synchronized (DETECTIONS_LOCK) {
            File file = new File(context.getFilesDir(), PENDING_DETECTIONS_FILENAME);
            if (!file.exists()) return new JSONArray();

            try (FileInputStream fis = new FileInputStream(file)) {
                byte[] data = new byte[(int) file.length()];
                fis.read(data);
                JSONArray result = new JSONArray(new String(data, "UTF-8"));
                file.delete();
                return result;
            } catch (Exception e) {
                file.delete();
                return new JSONArray();
            }
        }
    }

    private static String getNowIso() {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
        return sdf.format(new Date());
    }
}
