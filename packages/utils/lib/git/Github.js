import axios from "axios";
import { GitServer } from "./GitServer.js";

const BASE_URL = "https://api.github.com";

class Github extends GitServer {
  constructor() {
    super();

    this.service = axios.create({
      baseURL: BASE_URL,
      timeout: 5000,
    });
    this.service.interceptors.request.use(
      (config) => {
        config.headers["Authorization"] = `Bearer ${this.token}`;
        config.headers["Accept"] = "application/vnd.github+json";
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
    this.service.interceptors.response.use(
      (response) => {
        return response.data;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
  }

  get(url, params, headers) {
    return this.service({
      url,
      params,
      method: "get",
      headers,
    });
  }

  searchRepositories(params) {
    return this.get("/search/repositories", params);
  }
  searchCode(params) {
    return this.get("/search/code", params);
  }
  getTags(fullName, params) {
    return this.get(`/repos/${fullName}/tags`, params);
  }
  /**
   * 生成仓库链接
   */
  getRepoUrl(fullName) {
    return `https://github.com/${fullName}.git`;
  }
}

export default Github;
