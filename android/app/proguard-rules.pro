# 웹에 노출하는 브리지는 이름으로 불린다. 난독화되면 앱 안에서만 조용히 동작하지 않는다.
# (Phase 3 에서 @JavascriptInterface 객체가 들어온다)
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
