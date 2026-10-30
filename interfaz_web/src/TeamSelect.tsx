import { Children, isValidElement, type SelectHTMLAttributes } from "react";
import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import "./teamSelect.css";

export function TeamSelect({ icon: LeadingIcon, children, id, value, disabled, onChange }: SelectHTMLAttributes<HTMLSelectElement> & { icon: LucideIcon }) {
  const options = Children.toArray(children).filter(isValidElement<{ value: string; children: string }>).map(option => option.props);
  const placeholder = options.find(option => option.value === "")?.children;
  return <span className="team-select"><Select.Root value={String(value ?? "")} disabled={disabled} onValueChange={next => {
    // Existing field handlers consume only the selected value.
    onChange?.({ target: { value: next }, currentTarget: { value: next } } as React.ChangeEvent<HTMLSelectElement>);
  }}><Select.Trigger id={id} className="team-select-trigger"><LeadingIcon size={17} aria-hidden="true"/><Select.Value placeholder={placeholder}/><Select.Icon className="team-trigger-chevron"><ChevronDown size={16}/></Select.Icon></Select.Trigger><Select.Portal><Select.Content className="team-select-menu" position="popper" sideOffset={6} collisionPadding={12}><Select.Viewport>{options.filter(option => option.value !== "").map(option => <Select.Item key={option.value} value={String(option.value)} className="team-select-option"><Select.ItemText>{option.children}</Select.ItemText><Select.ItemIndicator className="team-option-check"><Check size={16}/></Select.ItemIndicator></Select.Item>)}</Select.Viewport></Select.Content></Select.Portal></Select.Root></span>;
}
