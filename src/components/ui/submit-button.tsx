"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "./button";

export type SubmitButtonProps = ButtonProps & {
  pendingLabel?: string;
};

/** Submit button that disables itself while its parent form action is running. */
export function SubmitButton({ children, pendingLabel, ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? (pendingLabel ?? "Please wait…") : children}
    </Button>
  );
}
