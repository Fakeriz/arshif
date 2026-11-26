import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const THEME_BOOTSTRAP = `(function(){try{var m=localStorage.getItem('arshif.themeMode');var dark=m==='dark'||(m!=='light'&&matchMedia('(prefers-color-scheme:dark)').matches);var r=document.documentElement;r.style.colorScheme=dark?'dark':'light';r.style.backgroundColor=dark?'#0D0D0D':'#E5E5E2';}catch(e){}})();`;

/**
 * Shell HTML statis untuk Expo Web: menyetel warna latar dan color-scheme lebih awal
 * agar tidak terjadi kilasan tema sebelum bundel JS dimuat.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="id">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <ScrollViewStyleReset />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
