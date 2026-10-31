package com.finanzas.app;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * DetectionParser
 *
 * Motor de parseo e interpretación nativa de notificaciones bancarias.
 * Espejo exacto de src/domain/detectionParser.js:
 *   - Usa únicamente expresiones regulares y patrones compatibles entre Java y JS.
 *   - Extrae monto en centavos enteros, divisa, tipo, comercio y últimos 4 dígitos.
 *   - Modo genérico para cualquier app bancaria permitida sin regla específica.
 *   - Filtro de patrones promocionales y de spam a ignorar.
 */
public class DetectionParser {

    public static final List<String> DEFAULT_IGNORE_PATTERNS = Arrays.asList(
        "promoci[oó]n",
        "descuento",
        "oferta",
        "cr[eé]dito preaprobado",
        "pr[eé]stamo disponible",
        "invita a tus amigos",
        "invitaci[oó]n",
        "gana dinero",
        "cashback especial",
        "actualiza tus datos",
        "nueva funci[oó]n",
        "seguridad",
        "c[oó]digo de seguridad",
        "token",
        "nip"
    );

    public static final String DEFAULT_EXPENSE_PATTERN =
        "compra|cargo|pago|pagaste|retiro|enviaste|salida|disposici[oó]n|spent|payment";
    public static final String DEFAULT_INCOME_PATTERN =
        "dep[oó]sito|abono|recibiste|n[oó]mina|sueldo|reembolso|devoluci[oó]n|received";

    public static class ParseResult {
        public boolean ignored = false;
        public Long amountCents = null;
        public String currency = "MXN";
        public String kind = null;
        public String merchant = null;
        public String last4 = null;
        public String parseConfidence = "low";
        public String matchedRuleId = null;
        public boolean hasAmount = false;

        public JSONObject toJsonObject() {
            JSONObject obj = new JSONObject();
            try {
                obj.put("ignored", ignored);
                obj.put("amountCents", amountCents != null ? amountCents : JSONObject.NULL);
                obj.put("currency", currency != null ? currency : "MXN");
                obj.put("kind", kind != null ? kind : JSONObject.NULL);
                obj.put("merchant", merchant != null ? merchant : JSONObject.NULL);
                obj.put("last4", last4 != null ? last4 : JSONObject.NULL);
                obj.put("parseConfidence", parseConfidence != null ? parseConfidence : "low");
                obj.put("matchedRuleId", matchedRuleId != null ? matchedRuleId : JSONObject.NULL);
                obj.put("hasAmount", hasAmount);
            } catch (Exception ignored) {
            }
            return obj;
        }
    }

    public static Long parseAmountToCents(String rawAmount) {
        if (rawAmount == null || rawAmount.trim().isEmpty()) return null;

        String cleaned = rawAmount.replaceAll("[^0-9.,]", "").trim();
        if (cleaned.isEmpty()) return null;

        if (cleaned.contains(",") && cleaned.contains(".")) {
            cleaned = cleaned.replace(",", "");
        } else if (cleaned.contains(",")) {
            if (cleaned.matches(".*,\\d{2}$")) {
                cleaned = cleaned.replace(',', '.');
            } else {
                cleaned = cleaned.replace(",", "");
            }
        }

        try {
            double val = Double.parseDouble(cleaned);
            return Math.round(val * 100);
        } catch (Exception e) {
            return null;
        }
    }

    public static boolean matchesAnyPattern(String text, List<String> patterns) {
        if (text == null || patterns == null) return false;
        for (String pat : patterns) {
            if (pat == null || pat.isEmpty()) continue;
            try {
                Pattern p = Pattern.compile(pat, Pattern.CASE_INSENSITIVE);
                if (p.matcher(text).find()) return true;
            } catch (Exception ignored) {
            }
        }
        return false;
    }

    public static ParseResult parseNotification(JSONObject notif, JSONArray rulesArray, JSONObject genericOptions) {
        ParseResult res = new ParseResult();
        if (notif == null) {
            res.ignored = true;
            return res;
        }

        String title = notif.optString("title", "").trim();
        String text = notif.optString("text", "").trim();
        String bigText = notif.optString("bigText", "").trim();
        String fullText = (title + " " + text + " " + bigText).trim();

        // 1. Verificar patrones ignorados
        List<String> allIgnore = new ArrayList<>(DEFAULT_IGNORE_PATTERNS);
        if (genericOptions != null && genericOptions.has("ignorePatterns")) {
            JSONArray arr = genericOptions.optJSONArray("ignorePatterns");
            if (arr != null) {
                for (int i = 0; i < arr.length(); i++) {
                    String p = arr.optString(i);
                    if (p != null && !p.isEmpty()) allIgnore.add(p);
                }
            }
        }

        if (matchesAnyPattern(fullText, allIgnore)) {
            res.ignored = true;
            return res;
        }

        String packageName = notif.optString("packageName", "").toLowerCase(Locale.US);

        // 2. Buscar en reglas específicas por app
        if (rulesArray != null) {
            for (int i = 0; i < rulesArray.length(); i++) {
                JSONObject rule = rulesArray.optJSONObject(i);
                if (rule == null) continue;
                if (!rule.optBoolean("enabled", true)) continue;

                String rulePkg = rule.optString("packageName", "").toLowerCase(Locale.US);
                if (!rulePkg.isEmpty() && !rulePkg.equals(packageName)) continue;

                // Match pattern general
                String matchPat = rule.optString("matchPattern", "");
                if (!matchPat.isEmpty()) {
                    try {
                        Pattern mp = Pattern.compile(matchPat, Pattern.CASE_INSENSITIVE);
                        if (!mp.matcher(fullText).find()) continue;
                    } catch (Exception ignored) {
                        continue;
                    }
                }

                // Extraer monto
                String amtRegex = rule.optString("amountRegex", "");
                if (!amtRegex.isEmpty()) {
                    try {
                        Pattern p = Pattern.compile(amtRegex, Pattern.CASE_INSENSITIVE);
                        Matcher m = p.matcher(fullText);
                        if (m.find()) {
                            int grp = rule.optInt("amountGroup", 1);
                            if (m.groupCount() >= grp) {
                                res.amountCents = parseAmountToCents(m.group(grp));
                            }
                        }
                    } catch (Exception ignored) {
                    }
                }

                // Extraer moneda
                res.currency = rule.optString("defaultCurrency", "MXN");
                String currRegex = rule.optString("currencyRegex", "");
                if (!currRegex.isEmpty()) {
                    try {
                        Pattern p = Pattern.compile(currRegex, Pattern.CASE_INSENSITIVE);
                        Matcher m = p.matcher(fullText);
                        if (m.find()) {
                            int grp = rule.optInt("currencyGroup", 1);
                            if (m.groupCount() >= grp) {
                                res.currency = m.group(grp).toUpperCase(Locale.US);
                            }
                        }
                    } catch (Exception ignored) {
                    }
                }

                // Extraer tipo
                JSONArray kindRules = rule.optJSONArray("kindRules");
                if (kindRules != null) {
                    for (int k = 0; k < kindRules.length(); k++) {
                        JSONObject kr = kindRules.optJSONObject(k);
                        if (kr != null) {
                            String kPat = kr.optString("pattern", "");
                            if (!kPat.isEmpty() && Pattern.compile(kPat, Pattern.CASE_INSENSITIVE).matcher(fullText).find()) {
                                res.kind = kr.optString("kind", "expense");
                                break;
                            }
                        }
                    }
                }

                // Extraer comercio
                String merchRegex = rule.optString("merchantRegex", "");
                if (!merchRegex.isEmpty()) {
                    try {
                        Pattern p = Pattern.compile(merchRegex, Pattern.CASE_INSENSITIVE);
                        Matcher m = p.matcher(fullText);
                        if (m.find()) {
                            int grp = rule.optInt("merchantGroup", 1);
                            if (m.groupCount() >= grp) {
                                res.merchant = m.group(grp).trim();
                            }
                        }
                    } catch (Exception ignored) {
                    }
                }

                // Extraer last4
                String last4Regex = rule.optString("last4Regex", "");
                if (!last4Regex.isEmpty()) {
                    try {
                        Pattern p = Pattern.compile(last4Regex, Pattern.CASE_INSENSITIVE);
                        Matcher m = p.matcher(fullText);
                        if (m.find()) {
                            int grp = rule.optInt("last4Group", 1);
                            if (m.groupCount() >= grp) {
                                res.last4 = m.group(grp).trim();
                            }
                        }
                    } catch (Exception ignored) {
                    }
                }

                res.hasAmount = res.amountCents != null;
                res.matchedRuleId = rule.optString("id", null);
                res.parseConfidence = res.hasAmount && res.kind != null ? "high" : "medium";
                return res;
            }
        }

        // 3. MODO GENÉRICO
        return parseGeneric(fullText, genericOptions);
    }

    private static ParseResult parseGeneric(String fullText, JSONObject options) {
        ParseResult res = new ParseResult();

        // 3.1 Extraer monto
        String[] amountPatterns = new String[] {
            "(?:[+\\-]?\\s*(?:\\$|USD|MXN|EUR|€)\\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\\.[0-9]{1,2})?|[0-9]+(?:\\.[0-9]{1,2})?))",
            "([0-9]{1,3}(?:,[0-9]{3})*(?:\\.[0-9]{1,2})?|[0-9]+(?:\\.[0-9]{1,2})?)\\s*(?:MXN|USD|EUR|pesos)\\b",
            "\\b([0-9]{1,3}(?:,[0-9]{3})+\\.[0-9]{2})\\b"
        };

        for (String pat : amountPatterns) {
            try {
                Pattern p = Pattern.compile(pat, Pattern.CASE_INSENSITIVE);
                Matcher m = p.matcher(fullText);
                if (m.find() && m.groupCount() >= 1) {
                    res.amountCents = parseAmountToCents(m.group(1));
                    if (res.amountCents != null) break;
                }
            } catch (Exception ignored) {
            }
        }

        // 3.2 Extraer divisa
        res.currency = "MXN";
        if (Pattern.compile("\\b(USD|d[oó]lar(?:es)?)\\b", Pattern.CASE_INSENSITIVE).matcher(fullText).find()) {
            res.currency = "USD";
        } else if (Pattern.compile("\\b(EUR|euro(?:s)?)\\b", Pattern.CASE_INSENSITIVE).matcher(fullText).find()) {
            res.currency = "EUR";
        }

        // 3.3 Deducir tipo
        String expPat = options != null && options.has("expensePattern") ? options.optString("expensePattern") : DEFAULT_EXPENSE_PATTERN;
        String incPat = options != null && options.has("incomePattern") ? options.optString("incomePattern") : DEFAULT_INCOME_PATTERN;

        if (Pattern.compile(incPat, Pattern.CASE_INSENSITIVE).matcher(fullText).find()) {
            res.kind = "income";
        } else if (Pattern.compile(expPat, Pattern.CASE_INSENSITIVE).matcher(fullText).find()) {
            res.kind = "expense";
        } else if (res.amountCents != null) {
            res.kind = "expense";
        }

        // 3.4 Extraer comercio (solo si hay monto detectado)
        if (res.amountCents != null) {
            try {
                Pattern mp = Pattern.compile("(?i)(?:\\ben\\b|\\bpara\\b|\\ba favor de\\b|\\bat\\b|\\bde\\b|\\bdesde\\b|\\ba\\b)\\s+([A-Za-z0-9áéíóúÁÉÍÓÚñÑ\\s.\\*\\-]{2,30}?)(?:\\s+v[ií]a|\\s+a\\s+tu|\\s+con|\\s+por|\\s+el|\\.|\\$|$)");
                Matcher mm = mp.matcher(fullText);
                if (mm.find() && mm.groupCount() >= 1) {
                    String clean = mm.group(1).trim();
                    if (!clean.matches("(?i)^(tu|su|un|una|la|el)\\s+(tarjeta|cuenta)$") &&
                        !clean.matches("(?i)^(dep[oó]sito|transferencia|pago|compra|spei)$")) {
                        res.merchant = clean;
                    }
                }
            } catch (Exception ignored) {
            }
        }

        // 3.5 Extraer últimos 4 dígitos
        try {
            Pattern lp = Pattern.compile("(?i)(?:tarjeta|cuenta|terminaci[oó]n|terminada en|termina en|\\*{1,8})\\s*([0-9]{4})\\b");
            Matcher lm = lp.matcher(fullText);
            if (lm.find() && lm.groupCount() >= 1) {
                res.last4 = lm.group(1).trim();
            }
        } catch (Exception ignored) {
        }

        res.hasAmount = res.amountCents != null;
        res.parseConfidence = res.hasAmount && res.kind != null ? "medium" : "low";
        return res;
    }

    public static String formatNotificationDisplayText(Long amountCents, String currency, String bankName, boolean showAmount) {
        String normBank = (bankName != null && !bankName.trim().isEmpty()) ? bankName.trim().toUpperCase(Locale.US) : null;
        boolean hasAmount = (amountCents != null && showAmount);

        String formattedAmount = null;
        if (hasAmount) {
            double pesos = amountCents / 100.0;
            String pesosStr = String.format(Locale.US, "%.2f", pesos);
            formattedAmount = "USD".equalsIgnoreCase(currency) ? "USD $" + pesosStr : "$" + pesosStr;
        }

        if (formattedAmount != null && normBank != null) {
            return "MOVIMIENTO DETECTADO POR " + formattedAmount + " DE LA CUENTA " + normBank;
        }

        if (normBank != null && formattedAmount == null) {
            return "MOVIMIENTO DETECTADO EN LA CUENTA " + normBank;
        }

        if (formattedAmount != null && normBank == null) {
            return "MOVIMIENTO DETECTADO POR " + formattedAmount;
        }

        return "MOVIMIENTO DETECTADO";
    }
}

