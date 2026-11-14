package com.hostmaster.access;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.concurrent.TimeUnit;

public class PairingActivity extends Activity {
    private TextView status;
    private EditText codeInput;
    private Button connectButton;

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(22), dp(28), dp(22), dp(22));
        root.setBackgroundColor(Color.rgb(2, 6, 23));

        TextView title = new TextView(this);
        title.setText("Vincular central Android");
        title.setTextColor(Color.WHITE);
        title.setTextSize(22);
        title.setGravity(Gravity.CENTER_VERTICAL);
        root.addView(title);

        TextView explanation = new TextView(this);
        explanation.setText("No painel HostMaster, gere um código para a casa piloto e cole-o abaixo. O código é de uso único e expira em 10 minutos.");
        explanation.setTextColor(Color.LTGRAY);
        explanation.setTextSize(14);
        explanation.setPadding(0, dp(12), 0, dp(18));
        root.addView(explanation);

        codeInput = new EditText(this);
        codeInput.setSingleLine(true);
        codeInput.setHint("Código de pareamento");
        codeInput.setTextColor(Color.WHITE);
        codeInput.setHintTextColor(Color.GRAY);
        root.addView(codeInput, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        connectButton = new Button(this);
        connectButton.setText("Conectar esta central");
        root.addView(connectButton);

        status = new TextView(this);
        status.setTextColor(Color.rgb(165, 180, 252));
        status.setTextSize(14);
        status.setPadding(0, dp(18), 0, 0);
        root.addView(status);

        Button close = new Button(this);
        close.setText("Voltar ao painel");
        close.setOnClickListener(v -> finish());
        root.addView(close);

        setContentView(root);
        showCurrentState();
        connectButton.setOnClickListener(v -> connect());
    }

    private void showCurrentState() {
        if (DeviceAgent.isPaired(this)) {
            codeInput.setVisibility(android.view.View.GONE);
            connectButton.setVisibility(android.view.View.GONE);
            status.setText("Este Android já está vinculado à casa: " + DeviceAgent.getPropertyTitle(this)
                    + "\nO vínculo é exclusivo desta instalação. Para transferi-lo, desvincule a central no painel do proprietário.");
        } else {
            status.setText("Aguardando código de pareamento.");
        }
    }

    private void connect() {
        String code = codeInput.getText().toString().trim();
        if (code.length() != 48) {
            status.setText("O código parece incompleto. Copie os 48 caracteres do painel.");
            return;
        }
        connectButton.setEnabled(false);
        status.setText("Validando código e vinculando esta central...");
        new Thread(() -> {
            try {
                JSONObject body = new JSONObject();
                body.put("p_pairing_code", code);
                body.put("p_node_name", "HostMaster Android");
                body.put("p_app_version", "1.1.0");
                JSONArray rows = DeviceAgent.rpc("claim_android_pairing", body);
                if (rows.length() == 0) throw new Exception("Código inválido, expirado ou já utilizado.");
                JSONObject row = rows.getJSONObject(0);
                DeviceAgent.savePairing(this, row.getString("node_id"), row.getString("node_secret"),
                        row.optString("property_title", "Casa vinculada"));
                boolean online = false;
                try { online = DeviceAgent.heartbeat(this); } catch (Exception ignored) {}
                try {
                    PeriodicWorkRequest work = new PeriodicWorkRequest.Builder(
                            HeartbeatWorker.class, 15, TimeUnit.MINUTES).build();
                    WorkManager.getInstance(this).enqueueUniquePeriodicWork(
                            "hostmaster-android-heartbeat", ExistingPeriodicWorkPolicy.KEEP, work);
                } catch (Exception ignored) {}
                final boolean onlineNow = online;
                runOnUiThread(() -> {
                    status.setText("Central vinculada à casa: " + DeviceAgent.getPropertyTitle(this)
                            + "\nComunicação com o HostMaster: " + (onlineNow ? "online" : "aguardando primeiro contato")
                            + "\nA integração física Primebras ainda será habilitada após a confirmação da API oficial.");
                    codeInput.setVisibility(android.view.View.GONE);
                    connectButton.setVisibility(android.view.View.GONE);
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    status.setText("Falha no pareamento: " + error.getMessage());
                    connectButton.setEnabled(true);
                });
            }
        }).start();
    }
}
