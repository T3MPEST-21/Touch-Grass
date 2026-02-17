package com.t3mpest.touchgrass

import android.app.*
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import java.util.*

class DetoxService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private var isRunning = false
    private val NOTIFICATION_ID = 999
    private val CHANNEL_ID = "detox-service-channel"

    private val monitorRunnable = object : Runnable {
        override fun run() {
            if (!isRunning) return
            checkCurrentApp()
            handler.postDelayed(this, 2000)
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = createNotification("GRASS ENFORCEMENT ACTIVE", "I am watching your discipline.")
        startForeground(NOTIFICATION_ID, notification)
        
        if (!isRunning) {
            isRunning = true
            handler.post(monitorRunnable)
        }
        
        return START_STICKY
    }

    private fun checkCurrentApp() {
        try {
            val usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val time = System.currentTimeMillis()
            
            // Get stats for today (midnight to now)
            val calendar = Calendar.getInstance()
            calendar.set(Calendar.HOUR_OF_DAY, 0)
            calendar.set(Calendar.MINUTE, 0)
            calendar.set(Calendar.SECOND, 0)
            calendar.set(Calendar.MILLISECOND, 0)
            val startTime = calendar.timeInMillis
            
            val stats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startTime, time)

            if (stats != null && stats.isNotEmpty()) {
                var topApp: String? = null
                var lastTimeUsed = 0L
                for (usageStats in stats) {
                    if (usageStats.lastTimeUsed > lastTimeUsed) {
                        topApp = usageStats.packageName
                        lastTimeUsed = usageStats.lastTimeUsed
                    }
                }

                if (topApp != null && topApp != packageName) {
                    val quotaMinutes = getQuotaForApp(topApp)
                    if (quotaMinutes > 0) {
                        // Find this specific app's usage from the query results
                        val appUsage = stats.find { it.packageName == topApp }
                        if (appUsage != null) {
                            val usedMinutes = appUsage.totalTimeInForeground / (1000 * 60)
                            if (usedMinutes >= quotaMinutes) {
                                launchShameOverlay()
                            }
                        }
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun getQuotaForApp(packageName: String): Int {
        val prefs = getSharedPreferences("TouchGrassPrefs", Context.MODE_PRIVATE)
        val quotaJsonStr = prefs.getString("victim_quotas", null) ?: return 0
        
        return try {
            val json = JSONObject(quotaJsonStr)
            if (json.has(packageName)) {
                json.getInt(packageName)
            } else {
                0
            }
        } catch (e: Exception) {
            0
        }
    }

    private fun launchShameOverlay() {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("touch-grass://locked"))
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
        startActivity(intent)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                CHANNEL_ID,
                "Touch Grass Monitor",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(serviceChannel)
        }
    }

    private fun createNotification(title: String, content: String): Notification {
        val notificationIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(content)
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setContentIntent(pendingIntent)
            .setColor(0x34C759)
            .build()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        isRunning = false
        handler.removeCallbacks(monitorRunnable)
        super.onDestroy()
    }
}

