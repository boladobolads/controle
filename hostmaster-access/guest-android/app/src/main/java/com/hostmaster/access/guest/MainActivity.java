package com.hostmaster.access.guest;

import android.app.Activity;
import android.os.Bundle;
import android.net.Uri;
import android.graphics.Color;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final String HOST = "hostmaster-access.pages.dev";
    private static final String APP_URL = "https://hostmaster-access.pages.dev/";
    private WebView webView;
    private LinearLayout welcome;

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        buildScreen();
        handleInvitation(getIntent());
    }

    private void buildScreen() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(2, 6, 23));

        TextView header = new TextView(this);
        header.setText("HostMaster Access");
        header.setTextColor(Color.WHITE);
        header.setTextSize(19);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(dp(20), dp(16), dp(20), dp(16));
        header.setBackgroundColor(Color.rgb(15, 23, 42));
        root.addView(header, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        welcome = new LinearLayout(this);
        welcome.setOrientation(LinearLayout.VERTICAL);
        welcome.setGravity(Gravity.CENTER);
        welcome.setPadding(dp(28), dp(28), dp(28), dp(28));

        TextView title = new TextView(this);
        title.setText("Acesse sua hospedagem");
        title.setTextColor(Color.WHITE);
        title.setTextSize(23);
        title.setGravity(Gravity.CENTER);
        welcome.addView(title);

        TextView instructions = new TextView(this);
        instructions.setText("Para entrar, abra o link de convite enviado pelo proprietário. O aplicativo solicitará seu e-mail e senha e mostrará somente os equipamentos autorizados para sua estadia.");
        instructions.setTextColor(Color.rgb(203, 213, 225));
        instructions.setTextSize(15);
        instructions.setGravity(Gravity.CENTER);
        instructions.setPadding(0, dp(14), 0, 0);
        welcome.addView(instructions);

        root.addView(welcome, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        webView = new WebView(this);
        webView.setVisibility(View.GONE);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                return !("https".equalsIgnoreCase(uri.getScheme())
                        && HOST.equalsIgnoreCase(uri.getHost()));
            }
        });
        root.addView(webView, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        setContentView(root);
    }

    private void handleInvitation(android.content.Intent intent) {
        if (intent == null || intent.getData() == null) return;

        Uri incoming = intent.getData();
        String token = incoming.getQueryParameter("invite");
        boolean trustedLink = "https".equalsIgnoreCase(incoming.getScheme())
                && HOST.equalsIgnoreCase(incoming.getHost());

        if (!trustedLink || token == null || token.trim().isEmpty()) {
            Toast.makeText(this, "Link de convite inválido.", Toast.LENGTH_LONG).show();
            return;
        }

        String inviteUrl = APP_URL + "?invite=" + Uri.encode(token.trim());
        welcome.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
        webView.loadUrl(inviteUrl);
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleInvitation(intent);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.getVisibility() == View.VISIBLE && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
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
