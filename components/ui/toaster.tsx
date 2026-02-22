"use client"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts
        .filter(({ title, description }) => title || description) // Only render toasts with content
        .map(function ({ id, title, description, action, ...props }) {
          return (
            <Toast key={id} {...props}>
              <div className="grid gap-1.5">
                {title && <ToastTitle className="text-sm font-semibold leading-none">{title}</ToastTitle>}
                {description && (
                  <ToastDescription className="text-sm opacity-90 whitespace-pre-line">{description}</ToastDescription>
                )}
              </div>
              {action}
              <ToastClose className="absolute right-1.5 top-1.5 rounded-md p-1.5 text-foreground/60 opacity-100 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-100 group-[.destructive]:focus:ring-destructive group-[.success]:text-green-300 group-[.success]:hover:text-green-100" />
            </Toast>
          )
        })}
      <ToastViewport className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]" />
    </ToastProvider>
  )
}
