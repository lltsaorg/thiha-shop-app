"use client";
import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description?: string;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void | Promise<void>;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  cancelLabel?: string;
  hideCancel?: boolean;
  children?: ReactNode;
};

export default function ConfirmModal({
  open,
  title,
  description,
  onOpenChange,
  onConfirm,
  confirmLabel = "確定",
  confirmDisabled = false,
  cancelLabel = "戻る",
  hideCancel = false,
  children,
}: ConfirmModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="mt-2 space-y-3">{children}</div>

        <DialogFooter className="gap-2">
          {!(hideCancel || cancelLabel === "") && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {cancelLabel}
            </Button>
          )}
          <Button onClick={onConfirm} disabled={confirmDisabled} aria-busy={confirmDisabled}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
