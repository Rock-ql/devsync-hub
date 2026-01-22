package com.devsync.client;

import cn.hutool.core.util.StrUtil;
import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONArray;
import com.alibaba.fastjson2.JSONObject;
import com.devsync.common.exception.BusinessException;
import com.devsync.entity.GitCommit;
import lombok.extern.slf4j.Slf4j;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * GitLab API 客户端
 *
 * @author xiaolei
 */
@Slf4j
@Component
public class GitLabClient {

    private final OkHttpClient httpClient;

    public GitLabClient() {
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .build();
    }

    /**
     * 获取GitLab分支列表
     *
     * @param gitlabUrl   GitLab仓库地址
     * @param token       Access Token
     * @param projectId   项目ID（可选）
     * @return 分支名称列表
     */
    public List<String> listBranches(String gitlabUrl, String token, Integer projectId) {
        log.info("[GitLab客户端] 获取分支列表，URL: {}, 项目ID: {}", gitlabUrl, projectId);

        String apiBaseUrl = parseApiBaseUrl(gitlabUrl);
        String projectIdentifier = resolveProjectIdentifier(gitlabUrl, projectId);
        if (StrUtil.isBlank(projectIdentifier)) {
            throw new BusinessException(400, "GitLab仓库地址格式不正确");
        }

        String apiUrl = String.format("%s/api/v4/projects/%s/repository/branches?per_page=100",
                apiBaseUrl, projectIdentifier);

        log.info("[GitLab客户端] 请求URL: {}", apiUrl);

        Request request = new Request.Builder()
                .url(apiUrl)
                .header("PRIVATE-TOKEN", token)
                .get()
                .build();

        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                String errorBody = response.body() != null ? response.body().string() : "无响应内容";
                log.error("[GitLab客户端] 分支请求失败，状态码: {}, 响应: {}", response.code(), errorBody);
                throw new BusinessException(500, "GitLab API请求失败: " + response.code());
            }

            String responseBody = response.body() != null ? response.body().string() : "[]";
            JSONArray branches = JSON.parseArray(responseBody);

            List<String> result = new ArrayList<>();
            for (int i = 0; i < branches.size(); i++) {
                JSONObject branch = branches.getJSONObject(i);
                String name = branch.getString("name");
                if (StrUtil.isNotBlank(name)) {
                    result.add(name);
                }
            }

            log.info("[GitLab客户端] 获取分支列表成功，数量: {}", result.size());
            return result;
        } catch (IOException e) {
            log.error("[GitLab客户端] 分支请求异常，URL: {}", apiUrl, e);
            throw new BusinessException(500, "GitLab API请求异常: " + e.getMessage());
        }
    }

    /**
     * 获取GitLab提交记录
     *
     * @param gitlabUrl   GitLab仓库地址
     * @param token       Access Token
     * @param projectId   项目ID
     * @param branch      分支名称
     * @return 提交记录列表
     */
    public List<GitCommit> getCommits(String gitlabUrl, String token, Integer projectId, String branch) {
        log.info("[GitLab客户端] 获取提交记录，URL: {}, 项目ID: {}, 分支: {}", gitlabUrl, projectId, branch);

        // 解析GitLab API基础URL
        String apiBaseUrl = parseApiBaseUrl(gitlabUrl);

        String projectIdentifier = resolveProjectIdentifier(gitlabUrl, projectId);
        if (StrUtil.isBlank(projectIdentifier)) {
            throw new BusinessException(400, "GitLab仓库地址格式不正确");
        }
        String encodedBranch = URLEncoder.encode(branch, StandardCharsets.UTF_8);

        // 构建API请求URL
        String apiUrl = String.format("%s/api/v4/projects/%s/repository/commits?ref_name=%s&per_page=100",
                apiBaseUrl, projectIdentifier, encodedBranch);

        log.info("[GitLab客户端] 请求URL: {}", apiUrl);

        Request request = new Request.Builder()
                .url(apiUrl)
                .header("PRIVATE-TOKEN", token)
                .get()
                .build();

        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                String errorBody = response.body() != null ? response.body().string() : "无响应内容";
                log.error("[GitLab客户端] 请求失败，状态码: {}, 响应: {}", response.code(), errorBody);
                throw new BusinessException(500, "GitLab API请求失败: " + response.code());
            }

            String responseBody = response.body() != null ? response.body().string() : "[]";
            log.info("[GitLab客户端] 响应内容: {}", responseBody.length() > 500 ? responseBody.substring(0, 500) + "..." : responseBody);
            JSONArray commits = JSON.parseArray(responseBody);

            List<GitCommit> result = new ArrayList<>();
            for (int i = 0; i < commits.size(); i++) {
                JSONObject commit = commits.getJSONObject(i);
                GitCommit gitCommit = new GitCommit();
                gitCommit.setCommitId(commit.getString("id"));
                gitCommit.setMessage(commit.getString("title"));
                gitCommit.setAuthorName(commit.getString("author_name"));
                gitCommit.setAuthorEmail(commit.getString("author_email"));

                // 解析提交时间
                String committedDate = commit.getString("committed_date");
                if (StrUtil.isNotBlank(committedDate)) {
                    gitCommit.setCommittedAt(parseDateTime(committedDate));
                }

                // 统计信息需要单独请求
                gitCommit.setAdditions(0);
                gitCommit.setDeletions(0);

                result.add(gitCommit);
            }

            log.info("[GitLab客户端] 获取提交记录成功，数量: {}", result.size());
            return result;

        } catch (IOException e) {
            log.error("[GitLab客户端] 请求异常，URL: {}", apiUrl, e);
            throw new BusinessException(500, "GitLab API请求异常: " + e.getMessage());
        }
    }

    /**
     * 获取指定时间范围内的提交记录
     *
     * @param gitlabUrl   GitLab仓库地址
     * @param token       Access Token
     * @param projectId   项目ID
     * @param branch      分支名称
     * @param since       开始时间
     * @param until       结束时间
     * @return 提交记录列表
     */
    public List<GitCommit> getCommitsByTimeRange(String gitlabUrl, String token, Integer projectId,
                                                   String branch, LocalDateTime since, LocalDateTime until) {
        log.info("[GitLab客户端] 获取时间范围内的提交记录，项目ID: {}, 分支: {}, since: {}, until: {}",
                projectId, branch, since, until);

        // 解析GitLab API基础URL
        String apiBaseUrl = parseApiBaseUrl(gitlabUrl);

        // 格式化时间
        DateTimeFormatter formatter = DateTimeFormatter.ISO_DATE_TIME;
        String sinceStr = since.format(formatter);
        String untilStr = until.format(formatter);

        String projectIdentifier = resolveProjectIdentifier(gitlabUrl, projectId);
        if (StrUtil.isBlank(projectIdentifier)) {
            throw new BusinessException(400, "GitLab仓库地址格式不正确");
        }
        String encodedBranch = URLEncoder.encode(branch, StandardCharsets.UTF_8);

        // 构建API请求URL
        String apiUrl = String.format("%s/api/v4/projects/%s/repository/commits?ref_name=%s&since=%s&until=%s&per_page=100",
                apiBaseUrl, projectIdentifier, encodedBranch, sinceStr, untilStr);

        Request request = new Request.Builder()
                .url(apiUrl)
                .header("PRIVATE-TOKEN", token)
                .get()
                .build();

        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                String errorBody = response.body() != null ? response.body().string() : "无响应内容";
                log.error("[GitLab客户端] 请求失败，状态码: {}, 响应: {}", response.code(), errorBody);
                throw new BusinessException(500, "GitLab API请求失败: " + response.code());
            }

            String responseBody = response.body() != null ? response.body().string() : "[]";
            JSONArray commits = JSON.parseArray(responseBody);

            List<GitCommit> result = new ArrayList<>();
            for (int i = 0; i < commits.size(); i++) {
                JSONObject commit = commits.getJSONObject(i);
                GitCommit gitCommit = new GitCommit();
                gitCommit.setCommitId(commit.getString("id"));
                gitCommit.setMessage(commit.getString("title"));
                gitCommit.setAuthorName(commit.getString("author_name"));
                gitCommit.setAuthorEmail(commit.getString("author_email"));

                String committedDate = commit.getString("committed_date");
                if (StrUtil.isNotBlank(committedDate)) {
                    gitCommit.setCommittedAt(parseDateTime(committedDate));
                }

                gitCommit.setAdditions(0);
                gitCommit.setDeletions(0);

                result.add(gitCommit);
            }

            log.info("[GitLab客户端] 获取时间范围内的提交记录成功，数量: {}", result.size());
            return result;

        } catch (IOException e) {
            log.error("[GitLab客户端] 请求异常", e);
            throw new BusinessException(500, "GitLab API请求异常: " + e.getMessage());
        }
    }

    /**
     * 测试GitLab连接
     *
     * @param gitlabUrl GitLab仓库地址
     * @param token     Access Token
     * @param projectId 项目ID
     * @return 是否连接成功
     */
    public boolean testConnection(String gitlabUrl, String token, Integer projectId) {
        log.info("[GitLab客户端] 测试连接，URL: {}, 项目ID: {}", gitlabUrl, projectId);

        String apiBaseUrl = parseApiBaseUrl(gitlabUrl);
        String projectIdentifier = resolveProjectIdentifier(gitlabUrl, projectId);
        if (StrUtil.isBlank(projectIdentifier)) {
            return false;
        }
        String apiUrl = String.format("%s/api/v4/projects/%s", apiBaseUrl, projectIdentifier);

        Request request = new Request.Builder()
                .url(apiUrl)
                .header("PRIVATE-TOKEN", token)
                .get()
                .build();

        try (Response response = httpClient.newCall(request).execute()) {
            boolean success = response.isSuccessful();
            log.info("[GitLab客户端] 连接测试结果: {}", success ? "成功" : "失败");
            return success;
        } catch (IOException e) {
            log.error("[GitLab客户端] 连接测试异常", e);
            return false;
        }
    }

    /**
     * 解析API基础URL
     */
    private String parseApiBaseUrl(String gitlabUrl) {
        // 移除末尾的斜杠
        gitlabUrl = gitlabUrl.replaceAll("/+$", "");

        // 如果是仓库URL，提取GitLab域名
        // 例如: https://gitlab.com/user/project -> https://gitlab.com
        if (gitlabUrl.contains(".git")) {
            gitlabUrl = gitlabUrl.replace(".git", "");
        }

        // 提取域名部分
        int pathStart = gitlabUrl.indexOf("/", gitlabUrl.indexOf("//") + 2);
        if (pathStart > 0) {
            gitlabUrl = gitlabUrl.substring(0, pathStart);
        }

        return gitlabUrl;
    }

    /**
     * 解析项目标识（优先项目ID，否则使用仓库路径）
     */
    private String resolveProjectIdentifier(String gitlabUrl, Integer projectId) {
        if (projectId != null && projectId > 0) {
            return projectId.toString();
        }
        String projectPath = parseProjectPath(gitlabUrl);
        if (StrUtil.isBlank(projectPath)) {
            return "";
        }
        return URLEncoder.encode(projectPath, StandardCharsets.UTF_8);
    }

    /**
     * 从仓库地址解析项目路径（group/subgroup/project）
     */
    private String parseProjectPath(String gitlabUrl) {
        if (StrUtil.isBlank(gitlabUrl)) {
            return "";
        }

        String cleanedUrl = gitlabUrl.trim();
        int hashIndex = cleanedUrl.indexOf('#');
        if (hashIndex >= 0) {
            cleanedUrl = cleanedUrl.substring(0, hashIndex);
        }
        int queryIndex = cleanedUrl.indexOf('?');
        if (queryIndex >= 0) {
            cleanedUrl = cleanedUrl.substring(0, queryIndex);
        }
        cleanedUrl = cleanedUrl.replaceAll("/+$", "");
        if (cleanedUrl.endsWith(".git")) {
            cleanedUrl = cleanedUrl.substring(0, cleanedUrl.length() - 4);
        }

        int pathStart = cleanedUrl.indexOf("//");
        if (pathStart >= 0) {
            pathStart = cleanedUrl.indexOf("/", pathStart + 2);
        } else {
            pathStart = cleanedUrl.indexOf("/");
        }

        if (pathStart < 0 || pathStart + 1 >= cleanedUrl.length()) {
            return "";
        }

        return cleanedUrl.substring(pathStart + 1);
    }

    /**
     * 解析ISO 8601格式的日期时间
     */
    private LocalDateTime parseDateTime(String dateTimeStr) {
        try {
            ZonedDateTime zdt = ZonedDateTime.parse(dateTimeStr);
            return zdt.toLocalDateTime();
        } catch (Exception e) {
            log.warn("[GitLab客户端] 日期解析失败: {}", dateTimeStr);
            return LocalDateTime.now();
        }
    }
}
