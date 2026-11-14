"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { BUCKET } from "@/lib/storage";

export default function SignedImage({ path, className = "", alt = "", onClick }) {
  const { supabase } = useAuth();
  const [url, setUrl] = useState("");

  useEffect(() => {
    let active = true;
    setUrl("");
    if (!path || !supabase) return;
    supabase.storage.from(BUCKET).createSignedUrl(path, 3600).then(({ data }) => {
      if (active && data) setUrl(data.signedUrl);
    });
    return () => { active = false; };
  }, [path, supabase]);

  if (!url) return <div className={"animate-pulse bg-white/5 " + className} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} onClick={onClick} />;
}
