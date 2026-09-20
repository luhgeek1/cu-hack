import { useCallback, useEffect, useRef, useState } from "react";

/** Дольше минуты говорить о трате не нужно, а платить за распознавание — тем более */
export const MAX_SECONDS = 60;

/** Короче этого — почти наверняка случайное касание */
const MIN_MS = 700;

type RecorderStatus = "idle" | "starting" | "recording";

type Options = {
  onResult: (file: File) => void;
  onError: (message: string) => void;
};

const FORMATS = [
  { mimeType: "audio/webm;codecs=opus", extension: "webm" },
  { mimeType: "audio/webm", extension: "webm" },
  { mimeType: "audio/mp4", extension: "mp4" },
  { mimeType: "audio/ogg;codecs=opus", extension: "ogg" },
];

const pickFormat = () => {
  const supported = FORMATS.find(
    (format) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(format.mimeType)
  );
  return supported ?? { mimeType: undefined, extension: "webm" };
};

export const isRecordingSupported = (): boolean =>
  typeof window !== "undefined" &&
  typeof MediaRecorder !== "undefined" &&
  Boolean(navigator.mediaDevices?.getUserMedia);

/**
 * Запись голоса на MediaRecorder: микрофон отпускается сразу после остановки,
 * а результат отдаётся одним файлом — бэкенд принимает только целую запись.
 */
export const useVoiceRecorder = ({ onResult, onError }: Options) => {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [seconds, setSeconds] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);
  const discardRef = useRef(false);

  const release = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    setStatus("idle");
    setSeconds(0);
  }, []);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  const cancel = useCallback(() => {
    discardRef.current = true;
    stop();
  }, [stop]);

  const start = useCallback(async () => {
    if (status !== "idle") return;

    if (!isRecordingSupported()) {
      onError(
        window.isSecureContext
          ? "Браузер не умеет записывать звук"
          : "Микрофон доступен только по https или на localhost"
      );
      return;
    }

    setStatus("starting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      setStatus("idle");
      const name = (error as DOMException | undefined)?.name;
      onError(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Нет доступа к микрофону — разрешите его в настройках браузера"
          : name === "NotFoundError"
            ? "Микрофон не найден"
            : "Не получилось включить микрофон"
      );
      return;
    }

    const format = pickFormat();
    const recorder = new MediaRecorder(stream, format.mimeType ? { mimeType: format.mimeType } : undefined);

    chunksRef.current = [];
    discardRef.current = false;
    startedAtRef.current = Date.now();

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      const elapsed = Date.now() - startedAtRef.current;
      const type = recorder.mimeType?.split(";")[0] || `audio/${format.extension}`;
      const blob = new Blob(chunksRef.current, { type });
      const discarded = discardRef.current;

      release();

      if (discarded) return;
      if (elapsed < MIN_MS || blob.size === 0) {
        onError("Слишком коротко — скажите, сколько и на что потратили");
        return;
      }
      onResult(new File([blob], `voice.${format.extension}`, { type }));
    };

    recorder.onerror = () => {
      release();
      onError("Запись прервалась");
    };

    recorderRef.current = recorder;
    streamRef.current = stream;
    recorder.start();
    setStatus("recording");
    setSeconds(0);
  }, [onError, onResult, release, status]);

  /** Таймер и жёсткий предел длительности */
  useEffect(() => {
    if (status !== "recording") return;

    const interval = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setSeconds(elapsed);
      if (elapsed >= MAX_SECONDS) stop();
    }, 250);

    return () => window.clearInterval(interval);
  }, [status, stop]);

  /** Уходя с экрана, не держим микрофон включённым */
  useEffect(() => () => {
    if (recorderRef.current?.state === "recording") {
      discardRef.current = true;
      recorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  return { status, seconds, start, stop, cancel, isRecording: status === "recording" };
};
