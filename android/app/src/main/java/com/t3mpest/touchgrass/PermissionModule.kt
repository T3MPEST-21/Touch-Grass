package com.t3mpest.touchgrass

import android.app.AppOpsManager
import android.content.Context
import android.os.Build
import android.os.Process
import android.provider.Settings
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.Arguments
import org.json.JSONObject
import org.json.JSONArray
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.app.usage.UsageStatsManager
import android.content.Intent
import android.os.PowerManager
import java.util.*


class PermissionModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "PermissionModule"
    }

    @ReactMethod
    fun checkOverlayPermission(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            promise.resolve(Settings.canDrawOverlays(reactApplicationContext))
        } else {
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun checkUsageStatsPermission(promise: Promise) {
        val appOps = reactApplicationContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                reactApplicationContext.packageName
            )
        } else {
            appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                reactApplicationContext.packageName
            )
        }
        promise.resolve(mode == AppOpsManager.MODE_ALLOWED)
    }

    @ReactMethod
    fun getTodayScreenTime(victimApps: ReadableArray?, promise: Promise) {
        try {
            val usageStatsManager = reactApplicationContext.getSystemService(Context.APP_OPS_SERVICE) as? UsageStatsManager 
                ?: reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            
            val calendar = Calendar.getInstance()
            calendar.set(Calendar.HOUR_OF_DAY, 0)
            calendar.set(Calendar.MINUTE, 0)
            calendar.set(Calendar.SECOND, 0)
            calendar.set(Calendar.MILLISECOND, 0)
            val startTime = calendar.timeInMillis
            val endTime = System.currentTimeMillis()

            val stats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startTime, endTime)
            var totalTime = 0L

            val filterSet = mutableSetOf<String>()
            if (victimApps != null) {
                for (i in 0 until victimApps.size()) {
                    victimApps.getString(i)?.let { filterSet.add(it) }
                }
            }

            if (stats != null) {
                for (usageStat in stats) {
                    if (filterSet.isEmpty() || filterSet.contains(usageStat.packageName)) {
                        totalTime += usageStat.totalTimeInForeground
                    }
                }
            }
            promise.resolve(totalTime.toDouble() / (1000 * 60 * 60)) // Return hours
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager
            val apps = pm.getInstalledApplications(PackageManager.GET_META_DATA)
            val appList = Arguments.createArray()

            for (app in apps) {
                val map = Arguments.createMap()
                map.putString("name", pm.getApplicationLabel(app).toString())
                map.putString("package", app.packageName)
                appList.pushMap(map)
            }
            promise.resolve(appList)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }


    @ReactMethod
    fun getCurrentApp(promise: Promise) {
        try {
            val usageStatsManager = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val time = System.currentTimeMillis()
            val stats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, time - 1000 * 10, time)

            if (stats != null && stats.isNotEmpty()) {
                var topApp: String? = null
                var lastTimeUsed = 0L
                for (usageStats in stats) {
                    if (usageStats.lastTimeUsed > lastTimeUsed) {
                        topApp = usageStats.packageName
                        lastTimeUsed = usageStats.lastTimeUsed
                    }
                }
                promise.resolve(topApp)
            } else {
                promise.resolve(null)
            }
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun startDetoxService(victimQuotas: ReadableMap, promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("TouchGrassPrefs", Context.MODE_PRIVATE)
            val editor = prefs.edit()
            
            // Convert ReadableMap to JSON string for the service
            val json = JSONObject()
            val iterator = victimQuotas.keySetIterator()
            while (iterator.hasNextKey()) {
                val pkg = iterator.nextKey()
                json.put(pkg, victimQuotas.getInt(pkg))
            }
            
            editor.putString("victim_quotas", json.toString())
            editor.apply()

            val intent = Intent(reactApplicationContext, DetoxService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactApplicationContext.startForegroundService(intent)
            } else {
                reactApplicationContext.startService(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopDetoxService(promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, DetoxService::class.java)
            reactApplicationContext.stopService(intent)
            
            val prefs = reactApplicationContext.getSharedPreferences("TouchGrassPrefs", Context.MODE_PRIVATE)
            prefs.edit().remove("victim_quotas").apply()
            
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun checkBatteryOptimization(promise: Promise) {
        try {
            val powerManager = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as PowerManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                promise.resolve(powerManager.isIgnoringBatteryOptimizations(reactApplicationContext.packageName))
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun getAppUsageHistory(packageName: String, days: Int, promise: Promise) {
        try {
            val usageStatsManager = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val calendar = Calendar.getInstance()
            val historyArray = Arguments.createArray()

            for (i in (days - 1) downTo 0) {
                val startCal = Calendar.getInstance()
                startCal.add(Calendar.DAY_OF_YEAR, -i)
                startCal.set(Calendar.HOUR_OF_DAY, 0)
                startCal.set(Calendar.MINUTE, 0)
                startCal.set(Calendar.SECOND, 0)
                startCal.set(Calendar.MILLISECOND, 0)

                val endCal = Calendar.getInstance()
                endCal.add(Calendar.DAY_OF_YEAR, -i)
                endCal.set(Calendar.HOUR_OF_DAY, 23)
                endCal.set(Calendar.MINUTE, 59)
                endCal.set(Calendar.SECOND, 59)
                endCal.set(Calendar.MILLISECOND, 999)

                val stats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startCal.timeInMillis, endCal.timeInMillis)
                var dailyTime = 0L
                if (stats != null) {
                    for (usageStats in stats) {
                        if (usageStats.packageName == packageName) {
                            dailyTime += usageStats.totalTimeInForeground
                        }
                    }
                }
                
                val dayMap = Arguments.createMap()
                dayMap.putDouble("time", dailyTime.toDouble() / (1000 * 60)) // Return minutes
                dayMap.putString("date", startCal.time.toString())
                historyArray.pushMap(dayMap)
            }
            promise.resolve(historyArray)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun getTargetUsageBreakdown(victimApps: ReadableArray, promise: Promise) {
        try {
            val usageStatsManager = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val calendar = Calendar.getInstance()
            calendar.set(Calendar.HOUR_OF_DAY, 0)
            calendar.set(Calendar.MINUTE, 0)
            calendar.set(Calendar.SECOND, 0)
            calendar.set(Calendar.MILLISECOND, 0)
            
            val startTime = calendar.timeInMillis
            val endTime = System.currentTimeMillis()

            val stats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startTime, endTime)
            val breakdown = Arguments.createMap()
            
            val filterSet = mutableSetOf<String>()
            for (i in 0 until victimApps.size()) {
                victimApps.getString(i)?.let { filterSet.add(it) }
            }

            if (stats != null) {
                for (usageStat in stats) {
                    if (filterSet.contains(usageStat.packageName)) {
                        breakdown.putDouble(usageStat.packageName, usageStat.totalTimeInForeground.toDouble() / (1000 * 60))
                    }
                }
            }
            promise.resolve(breakdown)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun getWeeklyTotalUsage(victimApps: ReadableArray, promise: Promise) {
        try {
            val usageStatsManager = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val weeklyArray = Arguments.createArray()
            
            val filterSet = mutableSetOf<String>()
            for (i in 0 until victimApps.size()) {
                victimApps.getString(i)?.let { filterSet.add(it) }
            }

            for (i in 6 downTo 0) {
                val startCal = Calendar.getInstance()
                startCal.add(Calendar.DAY_OF_YEAR, -i)
                startCal.set(Calendar.HOUR_OF_DAY, 0)
                startCal.set(Calendar.MINUTE, 0)
                startCal.set(Calendar.SECOND, 0)
                startCal.set(Calendar.MILLISECOND, 0)

                val endCal = Calendar.getInstance()
                endCal.add(Calendar.DAY_OF_YEAR, -i)
                endCal.set(Calendar.HOUR_OF_DAY, 23)
                endCal.set(Calendar.MINUTE, 59)
                endCal.set(Calendar.SECOND, 59)
                endCal.set(Calendar.MILLISECOND, 999)

                val stats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startCal.timeInMillis, endCal.timeInMillis)
                var dailySum = 0L
                if (stats != null) {
                    for (usageStat in stats) {
                        if (filterSet.contains(usageStat.packageName)) {
                            dailySum += usageStat.totalTimeInForeground
                        }
                    }
                }
                weeklyArray.pushDouble(dailySum.toDouble() / (1000 * 60)) // Minutes
            }
            promise.resolve(weeklyArray)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }
}

