export interface ProjectTokenRequest {
  requestId: number;
  projectId: string;
}

export function createProjectTokenRequest(requestId: number, projectId: string): ProjectTokenRequest {
  return { requestId, projectId };
}

export function shouldCommitProjectTokenRequest(
  activeRequest: ProjectTokenRequest | null,
  settledRequest: ProjectTokenRequest,
) {
  return Boolean(
    activeRequest &&
      activeRequest.requestId === settledRequest.requestId &&
      activeRequest.projectId === settledRequest.projectId,
  );
}
