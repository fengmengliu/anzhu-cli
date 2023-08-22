import Command from "@anzhu.com/command";
import {
  Github,
  Gitee,
  makeInput,
  makeList,
  getGitPlatform,
  log,
} from "@anzhu.com/utils";

const NEXP_PAGE = "${next_page}";
const PREV_PAGE = "${prev_page}";
const SEARCH_MODE_REPO = "search_repo";
const SEARCH_MODE_CODE = "search_code";

class InstallCommand extends Command {
  get command() {
    return "install";
  }

  get description() {
    return "install project";
  }

  get options() {}

  async action() {
    await this.generateGitAPI();
    await this.searchGitAPI();
    await this.selectTags();
    log.verbose('full_name', this.keyword);
    log.verbose('selected_tag', this.selectedTag);
  }

  async generateGitAPI() {
    let platform = getGitPlatform();
    if (!platform) {
      platform = await makeList({
        message: "请选择Git平台",
        choices: [
          {
            name: "GitHub",
            value: "github",
          },
          {
            name: "Gitee",
            value: "gitee",
          },
        ],
      });
    }
    log.verbose("platform:", platform);
    let gitAPI;
    if (platform === "github") {
      gitAPI = new Github();
    } else {
      gitAPI = new Gitee();
    }
    gitAPI.savePlatform(platform);
    await gitAPI.init();
    this.gitAPI = gitAPI;
  }

  async searchGitAPI() {
    const platform = this.gitAPI.getPlatform();
    if (platform === "github") {
      this.mode = await makeList({
        message: "请选择搜索模式",
        choices: [
          {
            name: "仓库",
            value: SEARCH_MODE_REPO,
          },
          {
            name: "源码",
            value: SEARCH_MODE_CODE,
          },
        ],
      });
    } else {
      this.mode = SEARCH_MODE_REPO;
    }
    // 1. 收集搜索关键词和开发语言
    this.q = await makeInput({
      message: "请输入搜索关键词",
      validate(value) {
        if (value.length > 0) {
          return true;
        } else {
          return "请输入搜索关键词";
        }
      },
    });
    this.language = await makeInput({
      message: "请输入开发语言",
    });
    this.page = 1;
    this.perPage = 10;
    await this.doSearch();
  }

  async doSearch() {
    const platform = this.gitAPI.getPlatform();
    let searchResult;
    let count = 0;
    let list = [];

    if (platform === "github") {
      // 2.生成搜索参数
      const params = {
        q: this.q + (this.language ? `+language:${this.language}` : ""),
        order: "desc",
        per_page: this.perPage,
        sort: "stars",
        page: this.page,
      };
      if (this.mode === SEARCH_MODE_REPO) {
        searchResult = await this.gitAPI.searchRepositories(params);
        count = searchResult.total_count;
        list = searchResult?.items?.map((item) => ({
          name: `${item.full_name}(${item.description})`,
          value: item.full_name,
        }));
      } else {
        // 目前查询仓库代码没有数据
        searchResult = await this.gitAPI.searchCode(params);
        count = searchResult.total_count;
        list = searchResult.items.map((item) => ({
          name:
            item.repository.full_name +
            (item.repository.description
              ? `${item.repository.description}`
              : ""),
          value: item.repository.full_name,
        }));
      }
    } else {
      // 2.生成搜索参数
      const params = {
        q: this.q,
        order: "desc",
        per_page: this.perPage,
        sort: "stars_count",
        page: this.page,
      };
      if (this.language) {
        // 此出language不能像github那样直接定义好，需要此处处理
        params.language = this.language; // 注意输入格式：JavaScript
      }
      searchResult = await this.gitAPI.searchRepositories(params);
      count = 9999999; // gitee没有给出总页数，此处给出默认值
      console.log("result:", searchResult);
      list = searchResult.map((item) => ({
        name: `${item.full_name}(${item.description})`,
        value: item.full_name,
      }));
    }
    // 判断当前页面，已经是否达到最大页数
    if (
      (platform === "github" && this.page * this.perPage < count) ||
      list.length > 0
    ) {
      list.push({
        name: "下一页",
        value: NEXP_PAGE,
      });
    }
    if (this.page > 1) {
      list.unshift({
        name: "上一页",
        value: PREV_PAGE,
      });
    }

    if (count > 0) {
      const keyword = await makeList({
        message:
          platform === "github"
            ? `请选择要下载的项目(共${count}条数据)`
            : "请选择下载的项目",
        choices: list,
      });

      if (keyword === NEXP_PAGE) {
        await this.nextPage();
      } else if (keyword === PREV_PAGE) {
        await this.prevPage();
      } else {
        // 下载项目
        this.keyword = keyword;
      }
    }
  }

  async nextPage() {
    this.page++;
    await this.doSearch();
  }

  async prevPage() {
    this.page--;
    await this.doSearch();
  }

  async selectTags() {
    let tagList;
    this.tagPage = 1;
    this.tagPerPage = 10;
    tagList = await this.doSelectTags();
  }

  async doSelectTags() {
    const platform = this.gitAPI.getPlatform();
    let tagListChoices = [];
    if (platform === "github") {
      const params = {
        page: this.tagPage,
        per_page: this.tagPerPage,
      };
      const tagList = await this.gitAPI.getTags(this.keyword, params);

      tagListChoices = tagList.map((item) => ({
        name: item.name,
        value: item.name,
      }));

      if (this.tagPage > 1) {
        tagListChoices.unshift({
          name: "上一页",
          value: PREV_PAGE,
        });
      }

      if (tagList.length > 0) {
        tagListChoices.push({
          name: "下一页",
          value: NEXP_PAGE,
        });
      }
    } else {
      const tagList = await this.gitAPI.getTags(this.keyword);
      tagListChoices = tagList.map((item) => ({
        name: item.name,
        value: item.name,
      }));
    }

    const selectedTag = await makeList({
      message: "请选择tag",
      choices: tagListChoices,
    });

    this.selectedTag = selectedTag;

    if (selectedTag === NEXP_PAGE) {
      await this.nextTags();
    } else if (selectedTag === PREV_PAGE) {
      await this.prevTags();
    } else {
      // 下载项目
      this.selectedTag = selectedTag;
    }
  }

  async nextTags() {
    this.tagPage++;
    await this.doSelectTags();
  }

  async prevTags() {
    this.tagPage--;
    await this.doSelectTags();
  }

  preAction() {
    // console.log('pre');
  }
  postAction() {
    // console.log('post');
  }
}

function Install(instance) {
  return new InstallCommand(instance);
}

export default Install;
