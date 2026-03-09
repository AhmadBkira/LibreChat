import React from 'react';
import { useHasAccess } from '~/hooks';
import { PermissionTypes, Permissions } from 'librechat-data-provider';

const SocialButton = ({ id, enabled, serverDomain, oauthPath, Icon, label }) => {
  const isAdmin = useHasAccess({
    permissionType: PermissionTypes.ADMIN,
    permission: Permissions.USE,
  });

  if (!enabled || !isAdmin) {
    return null;
  }

  return (
    <div className="mt-2 flex gap-x-2">
      <a
        aria-label={`${label}`}
        className="flex w-full items-center space-x-3 rounded-2xl border border-border-light bg-surface-primary px-5 py-3 text-text-primary transition-colors duration-200 hover:bg-surface-tertiary"
        href={`${serverDomain}/oauth/${oauthPath}`}
        data-testid={id}
      >
        <Icon />
        <p>{label}</p>
      </a>
    </div>
  );
};

export default SocialButton;