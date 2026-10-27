package com.finanzas.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Plugin de Capacitor para comunicar la web con el widget nativo de inicio:
 * 1. refresh: Escribe el snapshot y fuerza el redibujado de los widgets.
 * 2. requestPinWidget: Solicita anclar el widget a la pantalla de inicio (Android 8+).
 * 3. isPinSupported: Consulta compatibilidad del launcher.
 */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String KEY_SNAPSHOT = "widget_snapshot";

    @PluginMethod
    public void refresh(PluginCall call) {
        try {
            // Si la web envía el snapshot directamente en el payload, guardarlo
            JSObject snapshotObj = call.getObject("snapshot");
            if (snapshotObj != null) {
                SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                prefs.edit().putString(KEY_SNAPSHOT, snapshotObj.toString()).apply();
            }

            // Notificar a todos los widgets para actualizar la interfaz
            FinanceCardWidgetProvider.updateAllWidgets(getContext());

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error al refrescar widget: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void isPinSupported(PluginCall call) {
        JSObject ret = new JSObject();
        boolean supported = false;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                AppWidgetManager manager = getContext().getSystemService(AppWidgetManager.class);
                supported = manager != null && manager.isRequestPinAppWidgetSupported();
            } catch (Exception ignored) {
            }
        }

        ret.put("supported", supported);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPinWidget(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                AppWidgetManager manager = getContext().getSystemService(AppWidgetManager.class);
                if (manager != null && manager.isRequestPinAppWidgetSupported()) {
                    ComponentName provider = new ComponentName(getContext(), FinanceCardWidgetProvider.class);
                    manager.requestPinAppWidget(provider, null, null);

                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    call.resolve(ret);
                    return;
                } else {
                    call.reject("Tu launcher no soporta añadir widgets directamente. Sigue los pasos manuales.");
                    return;
                }
            } catch (Exception e) {
                call.reject("Error solicitando anclar widget: " + e.getMessage(), e);
                return;
            }
        }

        call.reject("La función requiere Android 8.0 o superior.");
    }
}
