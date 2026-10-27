"use client";
import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

const Toaster = ({
  ...props
}) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme}
      position="top-center"
      className="toaster group"
      style={{
        top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-zinc-950 dark:group-[.toaster]:bg-[#18181b] dark:group-[.toaster]:text-white group-[.toaster]:border-zinc-200 dark:group-[.toaster]:border-white/10 group-[.toaster]:shadow-lg font-medium",
          description: "group-[.toast]:text-zinc-500 dark:group-[.toast]:text-zinc-400",
          actionButton:
            "group-[.toast]:bg-zinc-950 group-[.toast]:text-white dark:group-[.toast]:bg-white dark:group-[.toast]:text-zinc-950",
          cancelButton:
            "group-[.toast]:bg-zinc-100 group-[.toast]:text-zinc-700 dark:group-[.toast]:bg-zinc-800 dark:group-[.toast]:text-zinc-300",
        },
      }}
      {...props} />
  );
}

export { Toaster }
