import { Link, NavLink, type LinkProps, type NavLinkProps } from 'react-router-dom';
import { withTenant } from '../tenant';
import { useBrand } from '../brand/BrandContext';

function tenantTo(to: LinkProps['to']): LinkProps['to'] {
  if (typeof to !== 'string') return to;
  return withTenant(to);
}

export function TLink(props: LinkProps) {
  return <Link {...props} to={tenantTo(props.to)} />;
}

export function TNavLink(props: NavLinkProps) {
  return <NavLink {...props} to={tenantTo(props.to)} />;
}

export function useTenantNav() {
  const { slug } = useBrand();
  return (path: string) => withTenant(path, slug);
}
