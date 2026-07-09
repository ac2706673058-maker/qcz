package com.lextv.app

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.core.content.FileProvider
import android.speech.tts.TextToSpeech
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONArray
import org.json.JSONObject
import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale

class MainActivity : Activity(), TextToSpeech.OnInitListener {

    private lateinit var web: WebView
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var recorder: AudioRecord? = null
    private var recording = false
    private var recordLang = "en"
    private var baiduToken = ""
    private var baiduTokenTime = 0L
    // 百度语音识别凭证(免费)
    private val BAIDU_API_KEY = "kXU19M5e5DM5uLfuE1e5woqy"
    private val BAIDU_SECRET_KEY = "GnejlUaOkaj6vOztuec6DMR9cTD1WtdN"
    private var recordThread: Thread? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        web = WebView(this)
        web.settings.javaScriptEnabled = true
        web.settings.allowFileAccess = true
        web.settings.domStorageEnabled = true
        web.settings.mediaPlaybackRequiresUserGesture = false
        web.setBackgroundColor(0xFF0D111E.toInt())
        web.addJavascriptInterface(Bridge(), "Bridge")
        web.isFocusable = false
        web.isFocusableInTouchMode = false
        setContentView(web)
        hideSystemUi()
        tts = TextToSpeech(this, this)
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), 1)
        }
        web.loadUrl("file:///android_asset/www/index.html")
    }

    private fun hideSystemUi() {
        window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_FULLSCREEN)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemUi()
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            fun bad(r: Int?) = r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED || r == null
            var r = tts?.setLanguage(Locale.US)
            if (bad(r)) r = tts?.setLanguage(Locale.UK)
            if (bad(r)) r = tts?.setLanguage(Locale.getDefault())
            if (bad(r)) { try { r = tts?.setLanguage(Locale.SIMPLIFIED_CHINESE) } catch (_: Exception) {} }
            ttsReady = !bad(r)
        }
        runOnUiThread { web.evaluateJavascript("window.onTtsReady && window.onTtsReady($ttsReady)", null) }
    }

    private fun sendKey(name: String): Boolean {
        runOnUiThread { web.evaluateJavascript("window.onTvKey && window.onTvKey('$name')", null) }
        return true
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        return when (keyCode) {
            KeyEvent.KEYCODE_DPAD_UP -> sendKey("UP")
            KeyEvent.KEYCODE_DPAD_DOWN -> sendKey("DOWN")
            KeyEvent.KEYCODE_DPAD_LEFT -> sendKey("LEFT")
            KeyEvent.KEYCODE_DPAD_RIGHT -> sendKey("RIGHT")
            KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_NUMPAD_ENTER -> sendKey("OK")
            KeyEvent.KEYCODE_BACK -> sendKey("BACK")
            KeyEvent.KEYCODE_MENU, KeyEvent.KEYCODE_SETTINGS, KeyEvent.KEYCODE_INFO,
            KeyEvent.KEYCODE_GUIDE, KeyEvent.KEYCODE_BOOKMARK -> sendKey("MENU")
            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, KeyEvent.KEYCODE_MEDIA_PLAY -> sendKey("PLAY")
            else -> super.onKeyDown(keyCode, event)
        }
    }

    override fun onDestroy() {
        tts?.shutdown()
        try { recording = false; recorder?.release() } catch (_: Exception) {}
        super.onDestroy()
    }

    private fun js(code: String) { runOnUiThread { web.evaluateJavascript(code, null) } }

    private fun doDownloadInstall(url: String) {
        js("window.onUpdateProgress && window.onUpdateProgress(0)")
        Thread {
            try {
                val outFile = File(cacheDir, "update.apk")
                if (outFile.exists()) outFile.delete()
                val c = URL(url).openConnection() as HttpURLConnection
                c.connectTimeout = 15000; c.readTimeout = 60000
                c.instanceFollowRedirects = true
                c.connect()
                if (c.responseCode !in 200..399) {
                    js("window.onUpdateErr && window.onUpdateErr(" + JSONObject.quote("\u4e0b\u8f7d\u5931\u8d25:HTTP " + c.responseCode) + ")"); return@Thread
                }
                val total = c.contentLength
                val input = c.inputStream
                val output = outFile.outputStream()
                val buf = ByteArray(8192)
                var downloaded = 0
                var lastPct = -1
                while (true) {
                    val n = input.read(buf)
                    if (n < 0) break
                    output.write(buf, 0, n)
                    downloaded += n
                    if (total > 0) {
                        val pct = (downloaded * 100 / total)
                        if (pct != lastPct) { lastPct = pct; js("window.onUpdateProgress && window.onUpdateProgress($pct)") }
                    }
                }
                output.flush(); output.close(); input.close()
                if (outFile.length() < 100000) {
                    js("window.onUpdateErr && window.onUpdateErr('\u4e0b\u8f7d\u7684\u6587\u4ef6\u5f02\u5e38(\u8fc7\u5c0f),\u8bf7\u68c0\u67e5\u4e0b\u8f7d\u5730\u5740')"); return@Thread
                }
                js("window.onUpdateProgress && window.onUpdateProgress(100)")
                installApk(outFile)
            } catch (e: Exception) {
                js("window.onUpdateErr && window.onUpdateErr(" + JSONObject.quote("\u4e0b\u8f7d\u51fa\u9519:" + (e.message ?: "")) + ")")
            }
        }.start()
    }

    private fun installApk(file: File) {
        runOnUiThread {
            try {
                val intent = Intent(Intent.ACTION_VIEW)
                intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
                val uri: Uri = if (Build.VERSION.SDK_INT >= 24) {
                    FileProvider.getUriForFile(this, "$packageName.fileprovider", file)
                } else {
                    Uri.fromFile(file)
                }
                intent.setDataAndType(uri, "application/vnd.android.package-archive")
                startActivity(intent)
                js("window.onUpdateReady && window.onUpdateReady()")
            } catch (e: Exception) {
                js("window.onUpdateErr && window.onUpdateErr(" + JSONObject.quote("\u65e0\u6cd5\u542f\u52a8\u5b89\u88c5\u5668:" + (e.message ?: "")) + ")")
            }
        }
    }

    private var pendingStart = false

    // 开始录音(16kHz 单声道 PCM)
    private fun startRecording() {
        if (recording) return
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            pendingStart = true
            js("window.onVoicePart && window.onVoicePart('\u6b63\u5728\u7533\u8bf7\u9ea6\u514b\u98ce\u6743\u9650...')")
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), 1)
            return
        }
        val sampleRate = 16000
        val minBuf = AudioRecord.getMinBufferSize(sampleRate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
        if (minBuf <= 0) { js("window.onVoiceErr && window.onVoiceErr('\u9ea6\u514b\u98ce\u4e0d\u53ef\u7528(\u672c\u673a\u4e0d\u652f\u6301\u5f55\u97f3)')"); return }
        val rec: AudioRecord
        try {
            rec = AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, sampleRate,
                AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, minBuf * 4)
        } catch (e: Exception) {
            js("window.onVoiceErr && window.onVoiceErr(" + JSONObject.quote("\u9ea6\u514b\u98ce\u521d\u59cb\u5316\u5931\u8d25:" + (e.message ?: "")) + ")"); return
        }
        if (rec.state != AudioRecord.STATE_INITIALIZED) {
            js("window.onVoiceErr && window.onVoiceErr('\u9ea6\u514b\u98ce\u65e0\u6cd5\u521d\u59cb\u5316,\u53ef\u80fd\u88ab\u5176\u5b83\u5e94\u7528\u5360\u7528')"); return
        }
        recorder = rec
        recording = true
        val pcm = ByteArrayOutputStream()
        rec.startRecording()
        js("window.onVoiceReady && window.onVoiceReady()")
        recordThread = Thread {
            val buf = ByteArray(minBuf)
            while (recording) {
                val n = try { rec.read(buf, 0, buf.size) } catch (e: Exception) { -1 }
                if (n > 0) pcm.write(buf, 0, n)
            }
            try { rec.stop() } catch (_: Exception) {}
            try { rec.release() } catch (_: Exception) {}
            val pcmBytes = pcm.toByteArray()
            if (pcmBytes.size < sampleRate) { // 少于0.5秒
                js("window.onVoiceErr && window.onVoiceErr('\u5f55\u97f3\u592a\u77ed,\u8bf7\u591a\u8bf4\u51e0\u79d2')")
                return@Thread
            }
            js("window.onVoicePart && window.onVoicePart('\u6b63\u5728\u8bc6\u522b...')")
            val wav = pcmToWav(pcmBytes, sampleRate)
            transcribe(wav)
        }
        recordThread?.start()
    }

    private fun stopRecording() {
        if (!recording) return
        recording = false  // 线程会自然结束并触发转写
    }

    // PCM16 加 WAV 头
    private fun pcmToWav(pcm: ByteArray, sampleRate: Int): ByteArray {
        val out = ByteArrayOutputStream()
        val dos = DataOutputStream(out)
        val totalDataLen = pcm.size + 36
        val byteRate = sampleRate * 2
        fun w(s: String) = dos.writeBytes(s)
        fun i32(v: Int) { dos.write(v and 0xff); dos.write((v shr 8) and 0xff); dos.write((v shr 16) and 0xff); dos.write((v shr 24) and 0xff) }
        fun i16(v: Int) { dos.write(v and 0xff); dos.write((v shr 8) and 0xff) }
        w("RIFF"); i32(totalDataLen); w("WAVE"); w("fmt "); i32(16); i16(1); i16(1)
        i32(sampleRate); i32(byteRate); i16(2); i16(16); w("data"); i32(pcm.size)
        dos.write(pcm)
        dos.flush()
        return out.toByteArray()
    }

    // 百度语音识别:先取access_token,再上传音频
    private fun transcribe(wav: ByteArray) {
        Thread {
            try {
                if (BAIDU_SECRET_KEY == "PUT_YOUR_SECRET_KEY_HERE") {
                    js("window.onVoiceErr && window.onVoiceErr('\u672a\u586b\u5199\u767e\u5ea6Secret Key,\u8bf7\u5148\u914d\u7f6e')"); return@Thread
                }
                // 1) 取token(缓存25天)
                val now = System.currentTimeMillis()
                if (baiduToken.isEmpty() || now - baiduTokenTime > 25L * 24 * 3600 * 1000) {
                    val turl = "https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=$BAIDU_API_KEY&client_secret=$BAIDU_SECRET_KEY"
                    val tc = URL(turl).openConnection() as HttpURLConnection
                    tc.requestMethod = "POST"; tc.connectTimeout = 15000; tc.readTimeout = 15000
                    val tst = if (tc.responseCode in 200..299) tc.inputStream else tc.errorStream
                    val tresp = tst.bufferedReader().readText()
                    val tj = JSONObject(tresp)
                    if (!tj.has("access_token")) {
                        js("window.onVoiceErr && window.onVoiceErr(" + JSONObject.quote("\u83b7\u53d6\u6388\u6743\u5931\u8d25:" + tresp.take(80)) + ")"); return@Thread
                    }
                    baiduToken = tj.getString("access_token"); baiduTokenTime = now
                }
                // 2) 上传音频识别
                val devPid = if (recordLang == "cn") 1537 else 1737
                val url = "https://vop.baidu.com/server_api"
                val c = URL(url).openConnection() as HttpURLConnection
                c.requestMethod = "POST"; c.doOutput = true
                c.connectTimeout = 15000; c.readTimeout = 40000
                c.setRequestProperty("Content-Type", "application/json")
                val speechB64 = android.util.Base64.encodeToString(wav, android.util.Base64.NO_WRAP)
                val body = JSONObject()
                body.put("format", "wav"); body.put("rate", 16000); body.put("channel", 1)
                body.put("cuid", "lextv-android"); body.put("token", baiduToken)
                body.put("dev_pid", devPid); body.put("len", wav.size)
                body.put("speech", speechB64)
                c.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
                val st = if (c.responseCode in 200..299) c.inputStream else c.errorStream
                val resp = st.bufferedReader().readText()
                val j = JSONObject(resp)
                val errNo = j.optInt("err_no", -1)
                if (errNo == 0 && j.has("result")) {
                    val arr = j.getJSONArray("result")
                    val text = if (arr.length() > 0) arr.getString(0) else ""
                    if (text.isBlank()) { js("window.onVoiceErr && window.onVoiceErr('\u6ca1\u542c\u6e05,\u8bf7\u518d\u8bf4\u4e00\u904d')") }
                    else { js("window.onVoice && window.onVoice(" + JSONObject.quote(text) + ")") }
                } else {
                    val em = j.optString("err_msg", "unknown")
                    js("window.onVoiceErr && window.onVoiceErr(" + JSONObject.quote("\u8bc6\u522b\u5931\u8d25(" + errNo + "):" + em) + ")")
                }
            } catch (e: Exception) {
                js("window.onVoiceErr && window.onVoiceErr(" + JSONObject.quote("\u7f51\u7edc\u9519\u8bef:" + (e.message ?: "")) + ")")
            }
        }.start()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 1) {
            val granted = grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
            val wantStart = pendingStart
            pendingStart = false
            if (granted && wantStart) { startRecording() }
            else if (!granted) { js("window.onVoiceErr && window.onVoiceErr('\u9ea6\u514b\u98ce\u6743\u9650\u88ab\u62d2\u7edd,\u8bf7\u5230\u7cfb\u7edf\u8bbe\u7f6e\u91cc\u5141\u8bb8')") }
        }
    }

    inner class Bridge {

        @JavascriptInterface
        fun speak(text: String, rate: Float) {
            if (!ttsReady) return
            tts?.setSpeechRate(rate)
            tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "lex")
        }

        @JavascriptInterface
        fun stopSpeak() { tts?.stop() }

        @JavascriptInterface
        fun isTtsReady(): Boolean = ttsReady

        @JavascriptInterface
        fun save(key: String, json: String) {
            try { File(filesDir, "$key.json").writeText(json) } catch (_: Exception) {}
        }

        @JavascriptInterface
        fun load(key: String): String {
            return try {
                val f = File(filesDir, "$key.json")
                if (f.exists()) f.readText() else ""
            } catch (_: Exception) { "" }
        }

        // 词库清单:内置assets/decks + 外部扩展目录(未来新增词书的口子)
        // 外部目录: /sdcard/Android/data/com.lextv.app/files/decks/*.json
        @JavascriptInterface
        fun getDecks(): String {
            val out = JSONArray()
            try {
                val mf = assets.open("decks/manifest.json").bufferedReader().readText()
                val arr = JSONObject(mf).getJSONArray("decks")
                for (i in 0 until arr.length()) {
                    val d = arr.getJSONObject(i)
                    d.put("source", "asset")
                    out.put(d)
                }
            } catch (_: Exception) {}
            try {
                val ext = File(getExternalFilesDir(null), "decks")
                if (ext.exists()) {
                    ext.listFiles { f -> f.name.endsWith(".json") }?.sortedBy { it.name }?.forEach { f ->
                        val d = JSONObject()
                        d.put("id", "ext_" + f.nameWithoutExtension)
                        d.put("name", f.nameWithoutExtension)
                        d.put("icon", "\uD83D\uDCD8")
                        d.put("files", JSONArray().put(f.name))
                        d.put("source", "ext")
                        out.put(d)
                    }
                }
            } catch (_: Exception) {}
            return out.toString()
        }

        @JavascriptInterface
        fun readDeckFile(source: String, name: String): String {
            return try {
                if (source == "ext") File(File(getExternalFilesDir(null), "decks"), name).readText()
                else assets.open("decks/$name").bufferedReader().readText()
            } catch (_: Exception) { "[]" }
        }

        @JavascriptInterface
        fun hasVoice(): Boolean = true

        @JavascriptInterface
        fun startListen(lang: String) {
            runOnUiThread { recordLang = if (lang == "cn") "cn" else "en"; startRecording() }
        }

        @JavascriptInterface
        fun stopListen() {
            runOnUiThread { stopRecording() }
        }

        @JavascriptInterface
        fun aiChat(payload: String, cbId: String) {
            Thread {
                var out = "{}"
                try {
                    val c = URL("https://open.bigmodel.cn/api/paas/v4/chat/completions").openConnection() as HttpURLConnection
                    c.requestMethod = "POST"
                    c.setRequestProperty("Content-Type", "application/json")
                    c.setRequestProperty("Authorization", "Bearer d4559d711e5a44b2818b657f8729df45.HBFjJ0FthlA0dI4N")
                    c.doOutput = true; c.connectTimeout = 15000; c.readTimeout = 30000
                    c.outputStream.use { it.write(payload.toByteArray(Charsets.UTF_8)) }
                    val st = if (c.responseCode in 200..299) c.inputStream else c.errorStream
                    out = st.bufferedReader().readText()
                } catch (e: Exception) {
                    out = "{\"error\":{\"message\":\"" + (e.message ?: "network error") + "\"}}"
                }
                runOnUiThread { web.evaluateJavascript("window.onAiReply('" + cbId + "'," + JSONObject.quote(out) + ")", null) }
            }.start()
        }

        @JavascriptInterface
        fun appVersionCode(): Int {
            return try { packageManager.getPackageInfo(packageName, 0).let { if (Build.VERSION.SDK_INT >= 28) it.longVersionCode.toInt() else @Suppress("DEPRECATION") it.versionCode } } catch (e: Exception) { 0 }
        }

        @JavascriptInterface
        fun appVersionName(): String {
            return try { packageManager.getPackageInfo(packageName, 0).versionName ?: "?" } catch (e: Exception) { "?" }
        }

        @JavascriptInterface
        fun downloadAndInstall(url: String) {
            runOnUiThread { doDownloadInstall(url) }
        }

        @JavascriptInterface
        fun exitApp() { runOnUiThread { finish() } }
    }
}
