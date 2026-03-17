"use client";

import { formatDuration } from "@/lib/time";
import { useEffect, useState } from "react";

export default function TimerPage() {
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    useEffect(() => {
        if (!isRunning) return;
        const intervalId = window.setInterval(() => {
            setElapsedSeconds((prevSeconds) => prevSeconds + 1);
        }, 1000);
        return () => {
            window.clearInterval(intervalId);
        };
    }, [isRunning]);

    const handleReset = () => {
        setElapsedSeconds(0);
        setIsRunning(true);
    }

    const handleStartStop = () => {
        if (!isRunning) {
            setIsRunning(true)
        }
        else {
            setIsRunning(false)
            setElapsedSeconds(0)
        }
    }

    return (
        <main className="mx-auto max-w-xl p-6">
            <h1 className="text-2xl font-semibold">Timer</h1>
            <p className="mt-4 text-4xl tabular-nums">{formatDuration(elapsedSeconds)}</p>
            <p className="mt-2 text-sm text-neutral-600">
                {isRunning ? "Timer is running" : "Timer is paused"}
            </p>
            <div className="mt-6 flex gap-3">
                <button
                    onClick={() => handleStartStop() }
                    className={`${!isRunning ? "rounded bg-green-600" : "rounded bg-red-600"}  px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50`}
                >
                    {!isRunning ? "start" : "Stop"}
                </button>
                <button
                    onClick={() => {
                        handleReset()
                    }}
                    disabled={elapsedSeconds === 0 && !isRunning}
                    className="rounded bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                    New Entry
                </button>
            </div>
        </main>
    );
}