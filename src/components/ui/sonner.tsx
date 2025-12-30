import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      toastOptions={{
        classNames: {
          toast:
            "group toast glass-toast group-[.toaster]:backdrop-blur-xl group-[.toaster]:bg-white/80 dark:group-[.toaster]:bg-black/70 group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-white/30 dark:group-[.toaster]:border-white/10 group-[.toaster]:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12),0_0_0_1px_rgba(255,255,255,0.1)_inset] group-[.toaster]:rounded-2xl",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-[13px]",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg group-[.toast]:font-medium",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-lg",
          title: "group-[.toast]:font-medium group-[.toast]:text-[14px]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
