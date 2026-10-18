'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/utils/cn';

/**
 * Remote photo with an initial fallback. Pass `key={photoURL}` from the parent so
 * the error state resets when the photo changes (no effect needed).
 */
export default function Avatar({ photoURL, name, size = 32, className }) {
  const [failed, setFailed] = useState(false);
  const initial = (name?.[0] ?? 'U').toUpperCase();

  return (
    <div
      style={{ width: size, height: size }}
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-subtle bg-accent-subtle/40 font-bold text-accent',
        className
      )}
    >
      {photoURL && !failed ? (
        <Image
          src={photoURL}
          alt=""
          width={size}
          height={size}
          className="size-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden="true" style={{ fontSize: size * 0.4 }}>
          {initial}
        </span>
      )}
    </div>
  );
}
