function flattenMenu(items, acc = []) {
  items.forEach((item) => {
    acc.push(item);
    if (item.children && item.children.length) {
      flattenMenu(item.children, acc);
    }
  });
  return acc;
}

function routeToRegex(route) {
  if (!route) {
    return null;
  }
  const parts = route.split('/').map((part) => {
    if (part.startsWith(':')) {
      return '[^/]+';
    }
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
  return new RegExp(`^${parts.join('/')}$`);
}

function buildBreadcrumbs(menuItems, currentPath) {
  const flat = flattenMenu(menuItems);
  const matched = flat.find((item) => {
    if (!item.route) {
      return false;
    }
    const regex = routeToRegex(item.route);
    if (!regex) {
      return false;
    }
    return regex.test(currentPath);
  });

  if (!matched) {
    return [
      { label: 'Home', href: '/' },
      { label: currentPath, href: currentPath },
    ];
  }

  const segments = matched.route.split('/').filter(Boolean);
  const crumbs = [{ label: 'Home', href: '/' }];
  let path = '';
  segments.forEach((segment) => {
    path += `/${segment}`;
    crumbs.push({
      label: segment.startsWith(':') ? 'Details' : segment.charAt(0).toUpperCase() + segment.slice(1),
      href: path,
    });
  });

  crumbs[crumbs.length - 1] = { label: matched.label, href: matched.route };
  return crumbs;
}

module.exports = {
  buildBreadcrumbs,
};
