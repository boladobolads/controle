package com.hostmaster.access;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.graphics.Color;
import android.view.Gravity;

public class MainActivity extends Activity {
    private WebView webView;
    private TextView nodeStatus;
    private static final String APP_URL = "https://rococo-daffodil-0c9d6a.netlify.app/";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(2, 6, 23));

        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.VERTICAL);
        header.setPadding(16, 10, 16, 10);
        header.setBackgroundColor(Color.rgb(15, 23, 42));

        TextView title = new TextView(this);
        title.setText("HostMaster Access · Central Android");
        title.setTextColor(Color.WHITE);
        title.setTextSize(16);
        title.setGravity(Gravity.CENTER_VERTICAL);
        header.addView(title);

        nodeStatus = new TextView(this);
        nodeStatus.setTextColor(Color.rgb(165, 180, 252));
        nodeStatus.setTextSize(12);
        nodeStatus.setPadding(0, 5, 0, 7);
        header.addView(nodeStatus);

        Button pairButton = new Button(this);
        pairButton.setText("Vincular este Android a uma casa");
        pairButton.setOnClickListener(v -> startActivity(new android.content.Intent(this, PairingActivity.class)));
        header.addView(pairButton);

        root.addView(header, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        webView = new WebView(this);
        webView.setLayoutParams(new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }
        });
        webView.setWebChromeClient(new WebChromeClient());
        root.addView(webView);
        setContentView(root);

        if (savedInstanceState == null) {
            webView.loadUrl(APP_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
        refreshNodeStatus();
    }

    @Override
    protected void onResume() {
        super.onResume();
        refreshNodeStatus();
        if (DeviceAgent.isPaired(this)) {
            new Thread(() -> {
                try { DeviceAgent.heartbeat(this); } catch (Exception ignored) {}
                runOnUiThread(this::refreshNodeStatus);
            }).start();
        }
    }

    private void refreshNodeStatus() {
        if (nodeStatus == null) return;
        if (DeviceAgent.isPaired(this)) {
            nodeStatus.setText("Central vinculada à casa: " + DeviceAgent.getPropertyTitle(this));
        } else {
            nodeStatus.setText("Este Android ainda não está vinculado a um imóvel.");
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) webView.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
