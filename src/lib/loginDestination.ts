export function loginDestination(access:{isAdmin?:boolean;isSubscribed?:boolean;hasMasterPass?:boolean},requested='') {
  if(!access.isSubscribed)return '/checkout';
  const safe=requested.startsWith('/')&&!requested.startsWith('//')&&!requested.includes('\\');
  if(safe){if(requested.startsWith('/admin')&&!access.isAdmin)return '/football';if(requested.startsWith('/predictor')&&!access.hasMasterPass)return '/checkout';return requested;}
  return access.isAdmin?'/admin':access.hasMasterPass?'/predictor':'/football';
}
