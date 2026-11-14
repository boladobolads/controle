package com.hostmaster.access;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;

import java.security.KeyStore;

public final class DeviceAgent {
    public static final String APP_URL = "https://rococo-daffodil-0c9d6a.netlify.app/";
    private static final String PREFS = "hostmaster_android_node";
    private static final String KEY_ALIAS = "hostmaster_android_node_key";
    private static final String APP_VERSION = "1.1.0";

    private DeviceAgent() {}

    private static String readAll(InputStream stream) throws Exception {
        BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8));
        StringBuilder out = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) out.append(line).append('\n');
        reader.close();
        return out.toString();
    }

    private static String extractConfigValue(String script, String field) throws Exception {
        int fieldAt = script.indexOf(field);
        if (fieldAt < 0) throw new Exception("Campo " + field + " não encontrado em config.js.");
        int colon = script.indexOf(':', fieldAt);
        if (colon < 0) throw new Exception("Configuração " + field + " inválida.");
        int quoteAt = -1;
        for (int i = colon + 1; i < script.length(); i++) {
            char c = script.charAt(i);
            if (c == '"' || c == '\'') { quoteAt = i; break; }
            if (c == ';' || c == '}') break;
        }
        if (quoteAt < 0) throw new Exception("Valor " + field + " não encontrado.");
        char quote = script.charAt(quoteAt);
        int end = script.indexOf(quote, quoteAt + 1);
        if (end < 0) throw new Exception("Valor " + field + " incompleto.");
        return script.substring(quoteAt + 1, end);
    }

    private static JSONObject loadConfig() throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(APP_URL + "config.js").openConnection();
        connection.setConnectTimeout(10000);
        connection.setReadTimeout(10000);
        connection.setRequestMethod("GET");
        int status = connection.getResponseCode();
        InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
        String script = readAll(stream);
        connection.disconnect();
        if (status < 200 || status >= 300) throw new Exception("Não foi possível carregar config.js (HTTP " + status + ").");
        JSONObject config = new JSONObject();
        config.put("url", extractConfigValue(script, "SUPABASE_URL"));
        config.put("key", extractConfigValue(script, "SUPABASE_ANON_KEY"));
        return config;
    }

    public static JSONArray rpc(String function, JSONObject body) throws Exception {
        JSONObject config = loadConfig();
        String base = config.getString("url").replaceAll("/+$", "");
        HttpURLConnection connection = (HttpURLConnection) new URL(base + "/rest/v1/rpc/" + function).openConnection();
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(15000);
        connection.setRequestMethod("POST");
        connection.setDoOutput(true);
        connection.setRequestProperty("apikey", config.getString("key"));
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setRequestProperty("Accept", "application/json");
        byte[] payload = body.toString().getBytes(StandardCharsets.UTF_8);
        try (OutputStream output = connection.getOutputStream()) {
            output.write(payload);
        }
        int status = connection.getResponseCode();
        InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
        String response = readAll(stream);
        connection.disconnect();
        if (status < 200 || status >= 300) throw new Exception("Supabase (" + status + "): " + response);
        return new JSONArray(response);
    }

    private static SecretKey getOrCreateKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (keyStore.containsAlias(KEY_ALIAS)) return (SecretKey) keyStore.getKey(KEY_ALIAS, null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build());
        return generator.generateKey();
    }

    public static void savePairing(Context context, String nodeId, String secret, String propertyTitle) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
        byte[] encrypted = cipher.doFinal(secret.getBytes(StandardCharsets.UTF_8));
        byte[] iv = cipher.getIV();
        byte[] packed = new byte[iv.length + encrypted.length];
        System.arraycopy(iv, 0, packed, 0, iv.length);
        System.arraycopy(encrypted, 0, packed, iv.length, encrypted.length);
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        prefs.edit()
                .putString("node_id", nodeId)
                .putString("node_secret", Base64.encodeToString(packed, Base64.NO_WRAP))
                .putString("property_title", propertyTitle)
                .apply();
    }

    private static String getSecret(Context context) throws Exception {
        String stored = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("node_secret", null);
        if (stored == null) return null;
        byte[] packed = Base64.decode(stored, Base64.NO_WRAP);
        if (packed.length <= 12) throw new Exception("Credencial local inválida.");
        byte[] iv = new byte[12];
        byte[] encrypted = new byte[packed.length - 12];
        System.arraycopy(packed, 0, iv, 0, 12);
        System.arraycopy(packed, 12, encrypted, 0, encrypted.length);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(128, iv));
        return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
    }

    public static boolean isPaired(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return prefs.contains("node_id") && prefs.contains("node_secret");
    }

    public static String getPropertyTitle(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getString("property_title", "Imóvel vinculado");
    }

    public static boolean heartbeat(Context context) throws Exception {
        if (!isPaired(context)) return false;
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSONObject body = new JSONObject();
        body.put("p_node_id", prefs.getString("node_id", ""));
        body.put("p_node_secret", getSecret(context));
        body.put("p_app_version", APP_VERSION);
        JSONArray result = rpc("heartbeat_android_node", body);
        return result.length() > 0;
    }
}
