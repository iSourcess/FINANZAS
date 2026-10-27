package com.finanzas.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONObject;
import java.text.NumberFormat;
import java.util.Locale;

/**
 * AppWidgetProvider para la tarjeta de Finanzas en la pantalla de inicio de Android.
 * Muestra el gasto de hoy, el balance del mes y dos botones de registro rápido (+ Gasto / + Ingreso).
 */
public class FinanceCardWidgetProvider extends AppWidgetProvider {

    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String KEY_SNAPSHOT = "widget_snapshot";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_card_layout);

        // Leer datos del snapshot desde SharedPreferences ("CapacitorStorage")
        long todaySpentCents = 0;
        long monthBalanceCents = 0;
        boolean showAmounts = false;

        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String jsonStr = prefs.getString(KEY_SNAPSHOT, null);

            if (jsonStr != null && !jsonStr.trim().isEmpty()) {
                JSONObject json = new JSONObject(jsonStr);
                todaySpentCents = json.optLong("todaySpentCents", 0);
                monthBalanceCents = json.optLong("monthBalanceCents", 0);
                showAmounts = json.optBoolean("showAmounts", false);
            }
        } catch (Exception e) {
            // En caso de error de lectura, se mantienen los valores por defecto
        }

        // Formatear montos respetando la privacidad
        if (showAmounts) {
            views.setTextViewText(R.id.widget_text_spent_today, formatCents(todaySpentCents, false));
            views.setTextViewText(R.id.widget_text_month_balance, formatCents(monthBalanceCents, true));
            views.setViewVisibility(R.id.widget_text_privacy_hint, View.GONE);
        } else {
            views.setTextViewText(R.id.widget_text_spent_today, "••••");
            views.setTextViewText(R.id.widget_text_month_balance, "••••");
            views.setViewVisibility(R.id.widget_text_privacy_hint, View.VISIBLE);
        }

        // 1. PendingIntent para "+ Gasto" -> finanzas://registrar?type=expense
        Intent intentExpense = new Intent(Intent.ACTION_VIEW, Uri.parse("finanzas://registrar?type=expense"));
        intentExpense.setPackage(context.getPackageName());
        intentExpense.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent piExpense = PendingIntent.getActivity(
            context,
            101,
            intentExpense,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_btn_expense, piExpense);

        // 2. PendingIntent para "+ Ingreso" -> finanzas://registrar?type=income
        Intent intentIncome = new Intent(Intent.ACTION_VIEW, Uri.parse("finanzas://registrar?type=income"));
        intentIncome.setPackage(context.getPackageName());
        intentIncome.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent piIncome = PendingIntent.getActivity(
            context,
            102,
            intentIncome,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_btn_income, piIncome);

        // 3. PendingIntent para el cuerpo de la tarjeta -> finanzas://panorama
        Intent intentOverview = new Intent(Intent.ACTION_VIEW, Uri.parse("finanzas://panorama"));
        intentOverview.setPackage(context.getPackageName());
        intentOverview.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent piOverview = PendingIntent.getActivity(
            context,
            103,
            intentOverview,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_root, piOverview);

        // Notificar al gestor de widgets
        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    /**
     * Actualiza todas las instancias activas del widget en la pantalla de inicio.
     */
    public static void updateAllWidgets(Context context) {
        try {
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            ComponentName component = new ComponentName(context, FinanceCardWidgetProvider.class);
            int[] ids = manager.getAppWidgetIds(component);
            if (ids != null && ids.length > 0) {
                for (int id : ids) {
                    updateAppWidget(context, manager, id);
                }
            }
        } catch (Exception ignored) {
        }
    }

    private static String formatCents(long cents, boolean includeSign) {
        boolean isNegative = cents < 0;
        double pesos = Math.abs(cents) / 100.0;
        NumberFormat nf = NumberFormat.getNumberInstance(new Locale("es", "MX"));
        nf.setMinimumFractionDigits(2);
        nf.setMaximumFractionDigits(2);
        String formatted = "$" + nf.format(pesos);

        if (includeSign) {
            if (cents > 0) return "+" + formatted;
            if (cents < 0) return "-" + formatted;
            return formatted;
        }

        return isNegative ? "-" + formatted : formatted;
    }
}
