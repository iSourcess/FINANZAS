package com.finanzas.app;

import android.app.PendingIntent;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;

/**
 * Servicio nativo para el Mosaico en el Panel de Ajustes Rápidos (Quick Settings Tile).
 * Al pulsar sobre el mosaico "Registrar gasto", abre directamente la aplicación
 * en la pantalla de registro con el formulario en modo Gasto mediante deep link.
 */
public class QuickRegisterTileService extends TileService {

    @Override
    public void onStartListening() {
        super.onStartListening();
        Tile tile = getQsTile();
        if (tile != null) {
            tile.setState(Tile.STATE_INACTIVE);
            tile.setLabel(getString(R.string.tile_quick_expense));
            tile.updateTile();
        }
    }

    @Override
    public void onClick() {
        super.onClick();

        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("finanzas://registrar?type=expense"));
        intent.setPackage(getPackageName());
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        // En Android 14+ (API 34, UPSIDE_DOWN_CAKE) startActivityAndCollapse(Intent) está obsoleto;
        // se debe usar la variante con PendingIntent.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            startActivityAndCollapse(pendingIntent);
        } else {
            // Android 13 (TIRAMISU) e inferiores
            startActivityAndCollapse(intent);
        }
    }
}
