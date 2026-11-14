package com.hostmaster.access;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

public class HeartbeatWorker extends Worker {
    public HeartbeatWorker(@NonNull Context context, @NonNull WorkerParameters parameters) {
        super(context, parameters);
    }

    @NonNull
    @Override
    public Result doWork() {
        if (!DeviceAgent.isPaired(getApplicationContext())) return Result.success();
        try {
            return DeviceAgent.heartbeat(getApplicationContext()) ? Result.success() : Result.retry();
        } catch (Exception error) {
            return Result.retry();
        }
    }
}
