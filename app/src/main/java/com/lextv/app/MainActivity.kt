package com.lextv.app

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
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
import android.media.MediaPlayer
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
    @Volatile private var destroyed = false
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
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.RECORD_AUDIO), 1)
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

    // 后台挂起/恢复必须转发给 WebView:不转发的话部分电视盒子回到前台后
    // WebView 渲染与 JS 计时器停在挂起态,表现为"整个应用点不动,只能强退重开"。
    override fun onPause() {
        try { web.onPause(); web.pauseTimers() } catch (_: Exception) {}
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        try { web.resumeTimers(); web.onResume() } catch (_: Exception) {}
        hideSystemUi()
        js("window.onAppResume && window.onAppResume()")
    }

    override fun onInit(status: Int) {
        if (destroyed) return
        if (status == TextToSpeech.SUCCESS) {
            fun bad(r: Int?) = r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED || r == null
            var r = tts?.setLanguage(Locale.US)
            if (bad(r)) r = tts?.setLanguage(Locale.UK)
            if (bad(r)) r = tts?.setLanguage(Locale.getDefault())
            if (bad(r)) { try { r = tts?.setLanguage(Locale.SIMPLIFIED_CHINESE) } catch (_: Exception) {} }
            ttsReady = !bad(r)
        }
        js("window.onTtsReady && window.onTtsReady($ttsReady)")
    }

    private fun sendKey(name: String): Boolean {
        js("window.onTvKey && window.onTvKey('$name')")
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
        destroyed = true
        tts?.shutdown()
        try { recording = false; recorder?.release() } catch (_: Exception) {}
        try { speakSeq++; mplayer?.release() } catch (_: Exception) {}
        try { ttsPool.shutdownNow() } catch (_: Exception) {}
        try {
            web.stopLoading()
            web.removeJavascriptInterface("Bridge")
            (web.parent as? android.view.ViewGroup)?.removeView(web)
            web.removeAllViews()
            web.destroy()
        } catch (_: Exception) {}
        super.onDestroy()
    }

    private fun js(code: String) {
        if (destroyed) return
        runOnUiThread {
            if (destroyed || !::web.isInitialized) return@runOnUiThread
            try { web.evaluateJavascript(code, null) } catch (_: Exception) {}
        }
    }

    private fun doDownloadInstall(url: String) {
        if (destroyed) return
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
        if (destroyed) return
        runOnUiThread {
            if (destroyed) return@runOnUiThread
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
        if (destroyed || recording) return
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            pendingStart = true
            js("window.onVoicePart && window.onVoicePart('\u6b63\u5728\u7533\u8bf7\u9ea6\u514b\u98ce\u6743\u9650...')")
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.RECORD_AUDIO), 1)
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

    // 取百度 access_token(缓存25天),识别与合成共用
    private fun ensureBaiduToken(): String {
        val now = System.currentTimeMillis()
        if (baiduToken.isNotEmpty() && now - baiduTokenTime < 25L * 24 * 3600 * 1000) return baiduToken
        try {
            val turl = "https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=$BAIDU_API_KEY&client_secret=$BAIDU_SECRET_KEY"
            val tc = URL(turl).openConnection() as HttpURLConnection
            tc.requestMethod = "POST"; tc.connectTimeout = 15000; tc.readTimeout = 15000
            val tst = if (tc.responseCode in 200..299) tc.inputStream else tc.errorStream
            val tj = JSONObject(tst.bufferedReader().readText())
            if (tj.has("access_token")) { baiduToken = tj.getString("access_token"); baiduTokenTime = now }
        } catch (_: Exception) {}
        return baiduToken
    }

    /* ===== 发音引擎 v2:整句一次合成 + 原生 MediaPlayer + 磁盘缓存 =====
       单词→有道词典音;短语/整句→百度翻译gettts(免key)→百度云text2audio(备)。
       彻底取代 WebView 内分段 Audio 播放,解决"句子只读一半/中间漏读"问题。 */
    private var mplayer: MediaPlayer? = null
    private var speakSeq = 0
    private val ttsPool = java.util.concurrent.Executors.newSingleThreadExecutor()

    private fun md5hex(s: String): String =
        java.security.MessageDigest.getInstance("MD5").digest(s.toByteArray(Charsets.UTF_8))
            .joinToString("") { String.format("%02x", it) }

    private fun ttsCacheFile(key: String): File {
        val dir = File(cacheDir, "tts")
        if (!dir.exists()) dir.mkdirs()
        return File(dir, md5hex(key) + ".mp3")
    }

    // 下载音频;返回 null 表示该源失败(非audio响应/太小/网络错)
    private fun fetchAudio(url: String, post: String?): ByteArray? {
        return try {
            val c = URL(url).openConnection() as HttpURLConnection
            c.connectTimeout = 8000; c.readTimeout = 20000
            c.instanceFollowRedirects = true
            c.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 9; SmartTV) AppleWebKit/537.36")
            if (post != null) {
                c.requestMethod = "POST"; c.doOutput = true
                c.setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
                c.outputStream.use { it.write(post.toByteArray(Charsets.UTF_8)) }
            }
            if (c.responseCode !in 200..299) return null
            val bytes = c.inputStream.readBytes()
            val ct = c.contentType ?: ""
            if (!ct.contains("audio", true) || bytes.size < 600) return null
            bytes
        } catch (e: Exception) { null }
    }

    private fun playTtsFile(f: File, rate: Float, seq: Int) {
        if (destroyed) return
        runOnUiThread {
            if (destroyed || seq != speakSeq) return@runOnUiThread
            try {
                try { mplayer?.release() } catch (_: Exception) {}
                val p = MediaPlayer()
                mplayer = p
                p.setDataSource(f.absolutePath)
                p.setOnCompletionListener { js("window.onSpeakDone && window.onSpeakDone()") }
                p.setOnErrorListener { _, _, _ -> js("window.onSpeakErr && window.onSpeakErr()"); true }
                p.prepare()
                if (Build.VERSION.SDK_INT >= 23 && rate > 0f && rate != 1.0f) {
                    try { p.playbackParams = p.playbackParams.setSpeed(rate) } catch (_: Exception) {}
                }
                p.start()
            } catch (e: Exception) {
                try { f.delete() } catch (_: Exception) {}
                js("window.onSpeakErr && window.onSpeakErr()")
            }
        }
    }

    private fun doSpeakText(text: String, rate: Float) {
        if (destroyed) return
        val seq = ++speakSeq
        runOnUiThread { if (!destroyed) try { mplayer?.stop() } catch (_: Exception) {} }
        try { ttsPool.execute {
            if (destroyed || seq != speakSeq) return@execute
            val t = text.replace(Regex("\\s+"), " ").trim().take(400)
            if (t.isEmpty()) return@execute
            val zh = t.any { it.code > 0x2E7F }
            val lan = if (zh) "zh" else "en"
            val cache = ttsCacheFile(lan + "|" + t)
            if (!cache.exists() || cache.length() < 600) {
                val enc = java.net.URLEncoder.encode(t, "UTF-8")
                var bytes: ByteArray? = null
                // 单个英文单词优先有道词典音(音质最佳);有道不支持短语和整句
                if (!zh && !t.contains(' ') && t.length <= 32)
                    bytes = fetchAudio("https://dict.youdao.com/dictvoice?audio=" + enc + "&type=2", null)
                // 主源:百度翻译在线合成,整句一次到位,不分段
                if (bytes == null)
                    bytes = fetchAudio("https://fanyi.baidu.com/gettts?lan=" + lan + "&text=" + enc + "&spd=4&source=web", null)
                // 备源:百度云短文本合成(App已配好凭证,lan=zh支持中英混读)
                if (bytes == null) {
                    val tok = ensureBaiduToken()
                    if (tok.isNotEmpty())
                        bytes = fetchAudio("https://tsn.baidu.com/text2audio",
                            "tex=" + enc + "&tok=" + tok + "&cuid=lextv-tts&ctp=1&lan=zh&spd=5&pit=5&vol=9&per=0&aue=3")
                }
                if (bytes == null) { if (!destroyed && seq == speakSeq) js("window.onSpeakErr && window.onSpeakErr()"); return@execute }
                try { cache.writeBytes(bytes) } catch (_: Exception) {}
                // 缓存瘦身:超过400条删最旧的一半
                try {
                    val fs = File(cacheDir, "tts").listFiles()
                    if (fs != null && fs.size > 400)
                        fs.sortedBy { it.lastModified() }.take(fs.size / 2).forEach { it.delete() }
                } catch (_: Exception) {}
            }
            if (destroyed || seq != speakSeq) return@execute
            playTtsFile(cache, rate, seq)
        } } catch (_: java.util.concurrent.RejectedExecutionException) {}
    }

    // 百度语音识别:先取access_token,再上传音频
    private fun transcribe(wav: ByteArray) {
        if (destroyed) return
        Thread {
            try {
                if (BAIDU_SECRET_KEY == "PUT_YOUR_SECRET_KEY_HERE") {
                    js("window.onVoiceErr && window.onVoiceErr('\u672a\u586b\u5199\u767e\u5ea6Secret Key,\u8bf7\u5148\u914d\u7f6e')"); return@Thread
                }
                if (ensureBaiduToken().isEmpty()) {
                    js("window.onVoiceErr && window.onVoiceErr('\u83b7\u53d6\u6388\u6743\u5931\u8d25,\u8bf7\u68c0\u67e5\u7f51\u7edc')"); return@Thread
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
        if (destroyed) return
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
            if (destroyed || !ttsReady) return
            tts?.setSpeechRate(rate)
            tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "lex")
        }

        @JavascriptInterface
        fun stopSpeak() {
            if (destroyed) return
            tts?.stop()
            speakSeq++
            runOnUiThread { try { mplayer?.stop() } catch (_: Exception) {} }
        }

        // 发音引擎v2:整句在线合成+原生播放。JS 优先调它
        @JavascriptInterface
        fun speakText(text: String, rate: Float) { doSpeakText(text, rate) }

        @JavascriptInterface
        fun hasNativeTts(): Boolean = true

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
            runOnUiThread {
                if (destroyed) return@runOnUiThread
                recordLang = if (lang == "cn") "cn" else "en"
                startRecording()
            }
        }

        @JavascriptInterface
        fun stopListen() {
            runOnUiThread { if (!destroyed) stopRecording() }
        }

        @JavascriptInterface
        fun aiChat(payload: String, cbId: String) {
            if (destroyed) return
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
                js("window.onAiReply('" + cbId + "'," + JSONObject.quote(out) + ")")
            }.start()
        }

        // 独立 AI 助手通道(与 AI 外教的 GLM 完全分开)。地址/密钥集中在此,便于更换。
        @JavascriptInterface
        fun aiChatX(payload: String, cbId: String) {
            if (destroyed) return
            Thread {
                var out = "{}"
                try {
                    val axUrl = "https://api.dejong21.me/v1/chat/completions"
                    val axKeyB64 = "c2steUlJMGdMY2RVb2VDVzJWY3R4SXZPakEyNHFLNUU4SGpYMFFKTnQ4VlBmUlV5RXhG"
                    val axKey = String(android.util.Base64.decode(axKeyB64, android.util.Base64.DEFAULT), Charsets.UTF_8).trim()
                    val c = URL(axUrl).openConnection() as HttpURLConnection
                    c.requestMethod = "POST"
                    c.setRequestProperty("Content-Type", "application/json")
                    c.setRequestProperty("Authorization", "Bearer $axKey")
                    c.doOutput = true; c.connectTimeout = 15000; c.readTimeout = 45000
                    c.outputStream.use { it.write(payload.toByteArray(Charsets.UTF_8)) }
                    val st = if (c.responseCode in 200..299) c.inputStream else c.errorStream
                    out = st.bufferedReader().readText()
                } catch (e: Exception) {
                    out = "{\"error\":{\"message\":\"" + (e.message ?: "network error") + "\"}}"
                }
                js("window.onAiReply('" + cbId + "'," + JSONObject.quote(out) + ")")
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
            runOnUiThread { if (!destroyed) doDownloadInstall(url) }
        }

        @JavascriptInterface
        fun exitApp() {
            runOnUiThread {
                try {
                    web.stopLoading()
                    web.loadUrl("about:blank")
                    web.clearHistory()
                } catch (_: Exception) {}
                // 用户主动从首页退出时移除整个任务；随后结束本进程，下一次一定是干净冷启动。
                try { finishAndRemoveTask() } catch (_: Exception) { finishAffinity() }
                android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                    android.os.Process.killProcess(android.os.Process.myPid())
                }, 180)
            }
        }
    }
}
