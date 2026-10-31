package com.finanzas.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.lang.ref.WeakReference;
import java.util.Iterator;
import java.util.Set;

/**
 * NotificationDetectionPlugin
 *
 * Plugin de Capacitor para comunicar la web con el NotificationListenerService nativo.
 * Métodos expuestos:
 *   - getListenerStatus: Devuelve si el permiso está otorgado, si el servicio está conectado y si la detección está activa.
 *   - openListenerSettings: Abre Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS.
 *   - openBatteryOptimizationSettings: Abre la pantalla de ajustes de optimización de batería.
 *   - requestRebind: Intenta reconectar el servicio tras desconexión del sistema.
 *   - setAllowlist: Guarda la lista de paquetes autorizados (bancos) y activa/desactiva la detección.
 *   - syncRules: Sincroniza las reglas de parseo declarativas y opciones de notificación.
 *   - listSeenApps: Devuelve la lista de apps vistas para configurar bancos.
 *   - clearSeenApps: Limpia el historial de apps vistas.
 *   - drainQueue: Obtiene y vacía la cola de muestras brutas acumuladas (para Modo Captura).
 *   - drainPendingDetections: Obtiene y vacía las detecciones pendientes parseadas nativamente.
 *
 * Eventos:
 *   - notificationReceived: Notificación entrante cuando la app está abierta.
 *   - detectionReceived: Detección parseada entrante en tiempo real.
 *   - listenerStateChanged: Cambio en el estado de conexión del servicio.
 */
@CapacitorPlugin(name = "NotificationDetection")
public class NotificationDetectionPlugin extends Plugin {

    private static final String TAG = "NotifDetectPlugin";
    private static WeakReference<NotificationDetectionPlugin> sInstance = null;

    @Override
    public void load() {
        super.load();
        sInstance = new WeakReference<>(this);
    }

    public static void onNativeNotificationReceived(JSONObject notifObj) {
        if (sInstance != null) {
            NotificationDetectionPlugin plugin = sInstance.get();
            if (plugin != null) {
                try {
                    JSObject jsData = new JSObject(notifObj.toString());
                    plugin.notifyListeners("notificationReceived", jsData);
                } catch (Exception e) {
                    Log.w(TAG, "Error notificando listener de notificación: " + e.getMessage());
                }
            }
        }
    }

    public static void onNativeDetectionReceived(JSONObject detectionObj) {
        if (sInstance != null) {
            NotificationDetectionPlugin plugin = sInstance.get();
            if (plugin != null) {
                try {
                    JSObject jsData = new JSObject(detectionObj.toString());
                    plugin.notifyListeners("detectionReceived", jsData);
                } catch (Exception e) {
                    Log.w(TAG, "Error notificando listener de detección: " + e.getMessage());
                }
            }
        }
    }

    public static void onListenerStateChanged(boolean connected) {
        if (sInstance != null) {
            NotificationDetectionPlugin plugin = sInstance.get();
            if (plugin != null) {
                JSObject ret = new JSObject();
                ret.put("isConnected", connected);
                plugin.notifyListeners("listenerStateChanged", ret);
            }
        }
    }

    @PluginMethod
    public void getListenerStatus(PluginCall call) {
        try {
            Context context = getContext();
            boolean isGranted = isNotificationAccessGranted(context);
            boolean isConnected = BankNotificationListenerService.isConnected();

            SharedPreferences prefs = context.getSharedPreferences(BankNotificationListenerService.PREFS_NAME, Context.MODE_PRIVATE);
            boolean isDetectionEnabled = prefs.getBoolean(BankNotificationListenerService.KEY_DETECTION_ENABLED, false);

            JSObject ret = new JSObject();
            ret.put("isPermissionGranted", isGranted);
            ret.put("isConnected", isConnected);
            ret.put("isDetectionEnabled", isDetectionEnabled);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error al consultar estado del servicio de notificaciones: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void openListenerSettings(PluginCall call) {
        try {
            Intent intent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
                intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            } else {
                intent = new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS");
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            try {
                Intent fallback = new Intent(Settings.ACTION_SETTINGS);
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(fallback);

                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception ex) {
                call.reject("No se pudo abrir la pantalla de ajustes de notificaciones: " + ex.getMessage(), ex);
            }
        }
    }

    @PluginMethod
    public void openBatteryOptimizationSettings(PluginCall call) {
        try {
            Intent intent = new Intent();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                intent.setAction(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            } else {
                intent.setAction(Settings.ACTION_SETTINGS);
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            try {
                Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                fallback.setData(Uri.parse("package:" + getContext().getPackageName()));
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(fallback);

                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception ex) {
                call.reject("No se pudo abrir ajustes de batería: " + ex.getMessage(), ex);
            }
        }
    }

    @PluginMethod
    public void requestRebind(PluginCall call) {
        try {
            boolean success = BankNotificationListenerService.rebindService(getContext());
            JSObject ret = new JSObject();
            ret.put("success", success);
            ret.put("isConnected", BankNotificationListenerService.isConnected());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error solicitando reconexión del servicio: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void setAllowlist(PluginCall call) {
        try {
            JSArray packages = call.getArray("packages");
            Boolean enabled = call.getBoolean("enabled");

            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(BankNotificationListenerService.PREFS_NAME, Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();

            if (packages != null) {
                editor.putString(BankNotificationListenerService.KEY_ALLOWLIST, packages.toString());
            }

            if (enabled != null) {
                editor.putBoolean(BankNotificationListenerService.KEY_DETECTION_ENABLED, enabled);
            }

            editor.apply();

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error al guardar lista de apps permitidas: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void syncRules(PluginCall call) {
        try {
            JSArray rules = call.getArray("rules");
            Boolean showAmount = call.getBoolean("showAmountInNotification");
            Boolean hideAmounts = call.getBoolean("hideAmounts");
            JSObject genericOptions = call.getObject("genericOptions");
            JSObject bankMappings = call.getObject("bankAccountMappings");

            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(BankNotificationListenerService.PREFS_NAME, Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();

            if (rules != null) {
                editor.putString(BankNotificationListenerService.KEY_DETECTION_RULES, rules.toString());
            }

            if (showAmount != null) {
                editor.putBoolean(BankNotificationListenerService.KEY_SHOW_AMOUNT, showAmount);
            }

            if (hideAmounts != null) {
                editor.putBoolean(BankNotificationListenerService.KEY_HIDE_AMOUNTS, hideAmounts);
            }

            if (genericOptions != null) {
                editor.putString(BankNotificationListenerService.KEY_GENERIC_OPTIONS, genericOptions.toString());
            }

            if (bankMappings != null) {
                editor.putString(BankNotificationListenerService.KEY_BANK_MAPPINGS, bankMappings.toString());
            }

            editor.apply();

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error al sincronizar reglas de detección: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void listSeenApps(PluginCall call) {
        try {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(BankNotificationListenerService.PREFS_NAME, Context.MODE_PRIVATE);
            String rawSeen = prefs.getString(BankNotificationListenerService.KEY_SEEN_APPS, "{}");

            JSONObject seenObj = new JSONObject(rawSeen);
            JSArray appsArray = new JSArray();

            Iterator<String> keys = seenObj.keys();
            while (keys.hasNext()) {
                String pkg = keys.next();
                JSONObject item = seenObj.optJSONObject(pkg);
                if (item != null) {
                    appsArray.put(new JSObject(item.toString()));
                }
            }

            JSObject ret = new JSObject();
            ret.put("apps", appsArray);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error listando aplicaciones vistas: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void clearSeenApps(PluginCall call) {
        try {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(BankNotificationListenerService.PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putString(BankNotificationListenerService.KEY_SEEN_APPS, "{}").apply();

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error limpiando aplicaciones vistas: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void drainQueue(PluginCall call) {
        try {
            Context context = getContext();
            JSONArray queued = BankNotificationListenerService.drainQueueStatic(context);

            JSArray result = new JSArray();
            for (int i = 0; i < queued.length(); i++) {
                JSONObject item = queued.optJSONObject(i);
                if (item != null) {
                    result.put(new JSObject(item.toString()));
                }
            }

            JSObject ret = new JSObject();
            ret.put("notifications", result);
            ret.put("count", result.length());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error al drenar cola de notificaciones: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void drainPendingDetections(PluginCall call) {
        try {
            Context context = getContext();
            JSONArray detections = BankNotificationListenerService.drainPendingDetectionsStatic(context);

            JSArray result = new JSArray();
            for (int i = 0; i < detections.length(); i++) {
                JSONObject item = detections.optJSONObject(i);
                if (item != null) {
                    result.put(new JSObject(item.toString()));
                }
            }

            JSObject ret = new JSObject();
            ret.put("detections", result);
            ret.put("count", result.length());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error al drenar detecciones pendientes: " + e.getMessage(), e);
        }
    }

    private boolean isNotificationAccessGranted(Context context) {
        try {
            Set<String> packageNames = NotificationManagerCompat.getEnabledListenerPackages(context);
            return packageNames.contains(context.getPackageName());
        } catch (Exception e) {
            try {
                String enabledListeners = Settings.Secure.getString(context.getContentResolver(), "enabled_notification_listeners");
                return enabledListeners != null && enabledListeners.contains(context.getPackageName());
            } catch (Exception ignored) {
                return false;
            }
        }
    }
}
