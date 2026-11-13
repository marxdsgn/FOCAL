import { useEffect, useState } from "react";
export function useStored(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return initial;
      const data = JSON.parse(raw);
      if (Array.isArray(initial)) return Array.isArray(data) ? data : initial;
      if (initial && typeof initial === "object")
        return data && typeof data === "object" && !Array.isArray(data)
          ? { ...initial, ...data }
          : initial;
      return typeof data === typeof initial ? data : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      window.dispatchEvent(new CustomEvent("focal-storage-error"));
    }
  }, [key, value]);
  return [value, setValue];
}
export async function preparePhoto(file) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    throw Error("Choose a JPG, PNG or WebP under 10 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let quality = 0.8,
      url = canvas.toDataURL("image/jpeg", quality);
    while (url.length > 350000 && quality > 0.25) {
      quality -= 0.1;
      url = canvas.toDataURL("image/jpeg", quality);
    }
    if (url.length > 500000)
      throw Error(
        "This image is too complex to save locally. Try a smaller photo.",
      );
    return {
      id: crypto.randomUUID(),
      url,
      name: file.name.replace(/\.[^.]+$/, "").slice(0, 100),
      category: "My Photography",
      addedAt: new Date().toISOString(),
    };
  } finally {
    bitmap.close();
  }
}
