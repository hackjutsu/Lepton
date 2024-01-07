import * as GitHubApi from './githubApi';
import * as GitLabApi from './gitlabApi';
import { remote } from 'electron';

const logger = remote.getGlobal('logger');
const provider = process.env.CLOUD_PROVIDER;

let Api;
if (provider === 'github') {
  Api = GitHubApi;
} else if (provider === 'gitlab') {
  Api = GitLabApi;
} else {
  logger.warn('Invalid or no CLOUD_PROVIDER environment variable set. Defaulting to GitHub.');
  Api = GitHubApi; // Default to GitHub API
}

export const getCloudProviderApi = Api.getCloudProviderApi;
