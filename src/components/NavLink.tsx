import { NavLink as RouterNavLink, NavLinkProps } from "react-router-dom";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { prefetchHandlers } from "@/lib/prefetch";

interface NavLinkCompatProps extends Omit<NavLinkProps, "className"> {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, to, onMouseEnter, onFocus, onTouchStart, ...props }, ref) => {
    const target = typeof to === "string" ? to : (to as { pathname?: string })?.pathname || "";
    const pf = prefetchHandlers(target);
    return (
      <RouterNavLink
        ref={ref}
        to={to}
        className={({ isActive, isPending }) =>
          cn(className, isActive && activeClassName, isPending && pendingClassName)
        }
        onMouseEnter={(e) => { pf.onMouseEnter(); onMouseEnter?.(e); }}
        onFocus={(e) => { pf.onFocus(); onFocus?.(e); }}
        onTouchStart={(e) => { pf.onTouchStart(); onTouchStart?.(e); }}
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };

