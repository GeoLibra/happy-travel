export type ShowroomFactorySetupCheckpoint =
  | 'geometry-ready'
  | 'material-ready'
  | 'object-ready'
  | 'setup-complete';

export interface ShowroomFactoryOptions {
  onSetupCheckpoint?: (checkpoint: ShowroomFactorySetupCheckpoint) => void;
}

interface DisposableResource {
  dispose: () => void;
}

type OwnResource = <TResource extends DisposableResource>(resource: TResource) => TResource;

export const notifySetupCheckpoint = (
  options: ShowroomFactoryOptions | undefined,
  checkpoint: ShowroomFactorySetupCheckpoint,
): void => {
  options?.onSetupCheckpoint?.(checkpoint);
};

const disposeAfterSetupFailure = (
  error: unknown,
  resources: ReadonlyArray<DisposableResource | undefined>,
): never => {
  for (const resource of resources) {
    try {
      resource?.dispose();
    } catch {
      // Preserve the construction error while still attempting every owned cleanup.
    }
  }
  throw error;
};

export const createShowroomResource = <TResource>(
  setup: (own: OwnResource) => TResource,
): TResource => {
  const ownedResources: DisposableResource[] = [];
  const own: OwnResource = (resource) => {
    ownedResources.push(resource);
    return resource;
  };

  try {
    return setup(own);
  } catch (error) {
    return disposeAfterSetupFailure(error, ownedResources);
  }
};

export const createIdempotentDisposer = (
  resources: ReadonlyArray<DisposableResource>,
): (() => void) => {
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;

    let firstError: unknown;
    let failed = false;
    for (const resource of resources) {
      try {
        resource.dispose();
      } catch (error) {
        if (!failed) {
          firstError = error;
          failed = true;
        }
      }
    }
    if (failed) throw firstError;
  };
};
