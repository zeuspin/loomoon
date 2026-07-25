import { Button as BaseButton } from "@base-ui/react/button";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle, type LucideIcon } from "lucide-react";
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  RefObject,
  ReactNode,
} from "react";
import { forwardRef, useId } from "react";

const buttonVariants = cva("lm-button", {
  variants: {
    variant: {
      primary: "lm-button--primary",
      secondary: "lm-button--secondary",
      ghost: "lm-button--ghost",
      danger: "lm-button--danger",
    },
    size: {
      sm: "lm-button--sm",
      md: "lm-button--md",
      lg: "lm-button--lg",
    },
  },
  defaultVariants: { variant: "secondary", size: "md" },
});

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonProps) {
  return (
    <BaseButton
      {...props}
      className={buttonVariants({ className, size, variant })}
    />
  );
}

export type IconButtonProps = Omit<ButtonProps, "aria-label"> & {
  label: string;
  icon?: LucideIcon;
  children?: ReactNode;
};

export function IconButton({
  label,
  icon: Icon,
  children,
  className,
  ...props
}: IconButtonProps) {
  return (
    <Button
      {...props}
      aria-label={label}
      className={["lm-icon-button", className].filter(Boolean).join(" ")}
    >
      {Icon ? <Icon aria-hidden="true" size={16} /> : children}
    </Button>
  );
}

export function Panel({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={["lm-panel", className].filter(Boolean).join(" ")}
    />
  );
}

const badgeVariants = cva("lm-badge", {
  variants: {
    tone: {
      neutral: "lm-badge--neutral",
      accent: "lm-badge--accent",
      success: "lm-badge--success",
      danger: "lm-badge--danger",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export type BadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span {...props} className={badgeVariants({ className, tone })} />;
}

export function Spinner({ label = "加载中" }: { label?: string }) {
  return (
    <span className="lm-spinner" role="status">
      <LoaderCircle aria-hidden="true" size={16} />
      <span className="lm-visually-hidden">{label}</span>
    </span>
  );
}

export type DialogProps = {
  actions?: ReactNode;
  children?: ReactNode;
  description?: ReactNode;
  initialFocus?: RefObject<HTMLElement | null> | undefined;
  open: boolean;
  title: ReactNode;
  onOpenChange: (open: boolean) => void;
};

export function Dialog({
  actions,
  children,
  description,
  initialFocus,
  open,
  title,
  onOpenChange,
}: DialogProps) {
  return (
    <BaseDialog.Root
      disablePointerDismissal
      onOpenChange={(nextOpen) => onOpenChange(nextOpen)}
      open={open}
    >
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="lm-dialog-backdrop" />
        <BaseDialog.Popup
          className="lm-dialog-popup"
          initialFocus={initialFocus}
        >
          <div className="lm-dialog-heading">
            <div>
              <BaseDialog.Title className="lm-dialog-title">
                {title}
              </BaseDialog.Title>
              {description && (
                <BaseDialog.Description className="lm-dialog-description">
                  {description}
                </BaseDialog.Description>
              )}
            </div>
            <BaseDialog.Close
              aria-label="关闭对话框"
              className="lm-dialog-close"
            >
              ×
            </BaseDialog.Close>
          </div>
          <div className="lm-dialog-body">{children}</div>
          {actions && <div className="lm-dialog-actions">{actions}</div>}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

export type DialogFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string | undefined;
  label: ReactNode;
};

export const DialogField = forwardRef<HTMLInputElement, DialogFieldProps>(
  ({ error, id, label, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;

    return (
      <label className="lm-dialog-field" htmlFor={inputId}>
        <span>{label}</span>
        <input
          {...props}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          id={inputId}
          ref={ref}
        />
        {error && (
          <small id={errorId} role="alert">
            {error}
          </small>
        )}
      </label>
    );
  },
);

DialogField.displayName = "DialogField";
