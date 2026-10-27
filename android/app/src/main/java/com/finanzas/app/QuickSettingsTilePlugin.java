package com.finanzas.app;

import android.app.StatusBarManager;
import android.content.ComponentName;
import android.graphics.drawable.Icon;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Plugin de Capacitor para interactuar con el panel de Ajustes Rápidos del sistema.
 * En Android 13+ (API 33+) permite solicitar directamente al usuario añadir
 * el mosaico mediante StatusBarManager.requestAddTileService.
 */
@CapacitorPlugin(name = "QuickSettingsTile")
public class QuickSettingsTilePlugin extends Plugin {

    @PluginMethod
    public void isSupported(PluginCall call) {
        JSObject ret = new JSObject();
        boolean supported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU; // API 33+
        ret.put("supported", supported);
        ret.put("sdkVersion", Build.VERSION.SDK_INT);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestAddTile(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            try {
                StatusBarManager statusBarManager = getContext().getSystemService(StatusBarManager.class);
                if (statusBarManager == null) {
                    call.reject("StatusBarManager no disponible en este dispositivo.");
                    return;
                }

                ComponentName componentName = new ComponentName(getContext(), QuickRegisterTileService.class);
                CharSequence label = getContext().getString(R.string.tile_quick_expense);
                Icon icon = Icon.createWithResource(getContext(), R.drawable.ic_shortcut_expense);

                statusBarManager.requestAddTileService(
                    componentName,
                    label,
                    icon,
                    getContext().getMainExecutor(),
                    resultCode -> {
                        JSObject result = new JSObject();
                        result.put("resultCode", resultCode);
                        result.put("success", true);
                        call.resolve(result);
                    }
                );
            } catch (Exception e) {
                call.reject("Error al solicitar agregar mosaico: " + e.getMessage(), e);
            }
        } else {
            call.reject("La solicitud programática de mosaico requiere Android 13 o superior. Consulta las instrucciones manuales.");
        }
    }
}
