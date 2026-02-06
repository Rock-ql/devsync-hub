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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * GitLab API 客户端
 *
 * @author xiaolei
 */
@Slf4j
@Component
public class GitLabClient {

    private static final String USER_AGENT = "DevSync-Hub";

    /**
     * 分支信息（包含名称和是否为默认分支）
     */
    @lombok.Data
    @lombok.AllArgsConstructor
    public static class BranchInfo {
        private String name;
        private boolean defaultBranch;
    }

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
     * @return 分支信息列表（包含名称和是否为默认分支）
     */
    public List<BranchInfo> listBranches(String gitlabUrl, String token, Integer projectId) {
        log.info("[GitLab客户端] 获取分支列表，URL: {}, 项目ID: {}", gitlabUrl, projectId);

        String apiBaseUrl = parseApiBaseUrl(gitlabUrl);

        String projectIdentifier = resolveProjectIdentifier(gitlabUrl, projectId);
        if (StrUtil.isBlank(projectIdentifier)) {
            throw new BusinessException(400, "GitLab仓库地址格式不正确");
        }

        try {
            return doListBranches(apiBaseUrl, projectIdentifier, token);
        } catch (BusinessException e) {
            // 容错：如果用户配置了 projectId，但填写错误，403/404 时尝试使用仓库路径重试
            if (shouldRetryWithProjectPath(e, projectId)) {
                String projectPathIdentifier = resolveProjectIdentifier(gitlabUrl, null);
                if (StrUtil.isNotBlank(projectPathIdentifier) && !projectPathIdentifier.equals(projectIdentifier)) {
                    log.warn("[GitLab客户端] 获取分支列表失败，尝试使用仓库路径重试，projectId={}", projectId);
                    return doListBranches(apiBaseUrl, projectPathIdentifier, token);
                }
            }
            throw e;
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

        try {
            return doGetCommits(apiBaseUrl, projectIdentifier, token, branch);
        } catch (BusinessException e) {
            // 容错：如果用户配置了 projectId，但填写错误，403/404 时尝试使用仓库路径重试
            if (shouldRetryWithProjectPath(e, projectId)) {
                String projectPathIdentifier = resolveProjectIdentifier(gitlabUrl, null);
                if (StrUtil.isNotBlank(projectPathIdentifier) && !projectPathIdentifier.equals(projectIdentifier)) {
                    log.warn("[GitLab客户端] 获取提交记录失败，尝试使用仓库路径重试，projectId={}", projectId);
                    return doGetCommits(apiBaseUrl, projectPathIdentifier, token, branch);
                }
            }
            throw e;
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

        try {
            return doGetCommitsByTimeRange(apiBaseUrl, projectIdentifier, token, branch, sinceStr, untilStr);
        } catch (BusinessException e) {
            // 容错：如果用户配置了 projectId，但填写错误，403/404 时尝试使用仓库路径重试
            if (shouldRetryWithProjectPath(e, projectId)) {
                String projectPathIdentifier = resolveProjectIdentifier(gitlabUrl, null);
                if (StrUtil.isNotBlank(projectPathIdentifier) && !projectPathIdentifier.equals(projectIdentifier)) {
                    log.warn("[GitLab客户端] 获取提交记录失败，尝试使用仓库路径重试，projectId={}", projectId);
                    return doGetCommitsByTimeRange(apiBaseUrl, projectPathIdentifier, token, branch, sinceStr, untilStr);
                }
            }
            throw e;
        }
    }

    /**
     * 获取所有活跃分支的提交记录（按commitId去重，保留首次出现的分支）
     *
     * @param gitlabUrl   GitLab仓库地址
     * @param token       Access Token
     * @param projectId   项目ID
     * @return 提交记录列表（已设置branch字段）
     */
    public List<GitCommit> getCommitsAllBranches(String gitlabUrl, String token, Integer projectId) {
        log.info("[GitLab客户端] 获取所有分支的提交记录，URL: {}, 项目ID: {}", gitlabUrl, projectId);

        List<BranchInfo> branches = listBranches(gitlabUrl, token, projectId);
        if (branches.isEmpty()) {
            log.warn("[GitLab客户端] 未获取到任何分支");
            return List.of();
        }

        // 按commitId去重，保留首次出现的分支
        Map<String, GitCommit> commitMap = new LinkedHashMap<>();
        for (BranchInfo branch : branches) {
            try {
                List<GitCommit> branchCommits = getCommits(gitlabUrl, token, projectId, branch.getName());
                for (GitCommit commit : branchCommits) {
                    GitCommit existingCommit = commitMap.get(commit.getCommitId());
                    if (existingCommit == null) {
                        commit.setBranch(branch.getName());
                        commitMap.put(commit.getCommitId(), commit);
                    } else {
                        appendBranchIfMissing(existingCommit, branch.getName());
                    }
                }
            } catch (Exception e) {
                log.warn("[GitLab客户端] 获取分支 {} 的提交记录失败，跳过", branch.getName(), e);
            }
        }

        log.info("[GitLab客户端] 所有分支提交记录获取完成，去重后数量: {}", commitMap.size());
        return new ArrayList<>(commitMap.values());
    }

    /**
     * 获取所有活跃分支在指定时间范围内的提交记录（按commitId去重）
     *
     * @param gitlabUrl   GitLab仓库地址
     * @param token       Access Token
     * @param projectId   项目ID
     * @param since       开始时间
     * @param until       结束时间
     * @return 提交记录列表（已设置branch字段）
     */
    public List<GitCommit> getCommitsByTimeRangeAllBranches(String gitlabUrl, String token, Integer projectId,
                                                             LocalDateTime since, LocalDateTime until) {
        log.info("[GitLab客户端] 获取所有分支时间范围内的提交记录，项目ID: {}, since: {}, until: {}",
                projectId, since, until);

        List<BranchInfo> branches = listBranches(gitlabUrl, token, projectId);
        if (branches.isEmpty()) {
            log.warn("[GitLab客户端] 未获取到任何分支");
            return List.of();
        }

        Map<String, GitCommit> commitMap = new LinkedHashMap<>();
        for (BranchInfo branch : branches) {
            try {
                List<GitCommit> branchCommits = getCommitsByTimeRange(
                        gitlabUrl, token, projectId, branch.getName(), since, until);
                for (GitCommit commit : branchCommits) {
                    GitCommit existingCommit = commitMap.get(commit.getCommitId());
                    if (existingCommit == null) {
                        commit.setBranch(branch.getName());
                        commitMap.put(commit.getCommitId(), commit);
                    } else {
                        appendBranchIfMissing(existingCommit, branch.getName());
                    }
                }
            } catch (Exception e) {
                log.warn("[GitLab客户端] 获取分支 {} 的时间范围提交记录失败，跳过", branch.getName(), e);
            }
        }

        log.info("[GitLab客户端] 所有分支时间范围提交记录获取完成，去重后数量: {}", commitMap.size());
        return new ArrayList<>(commitMap.values());
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

        try {
            return doTestConnection(apiUrl, token);
        } catch (BusinessException e) {
            if (shouldRetryWithProjectPath(e, projectId)) {
                String projectPathIdentifier = resolveProjectIdentifier(gitlabUrl, null);
                if (StrUtil.isNotBlank(projectPathIdentifier) && !projectPathIdentifier.equals(projectIdentifier)) {
                    String retryUrl = String.format("%s/api/v4/projects/%s", apiBaseUrl, projectPathIdentifier);
                    log.warn("[GitLab客户端] 连接测试失败，尝试使用仓库路径重试，projectId={}", projectId);
                    return doTestConnection(retryUrl, token);
                }
            }
            return false;
        }
    }

    private boolean doTestConnection(String apiUrl, String token) {
        Request request = buildGetRequest(apiUrl, token);

        try (Response response = httpClient.newCall(request).execute()) {
            boolean success = response.isSuccessful();
            log.info("[GitLab客户端] 连接测试结果: {}", success ? "成功" : "失败");
            if (!success) {
                String errorBody = response.body() != null ? response.body().string() : "";
                log.warn("[GitLab客户端] 连接测试失败，状态码: {}, 响应: {}", response.code(), errorBody);
                throw buildGitLabApiException(response.code(), errorBody);
            }
            return true;
        } catch (IOException e) {
            log.error("[GitLab客户端] 连接测试异常", e);
            return false;
        }
    }

    private List<BranchInfo> doListBranches(String apiBaseUrl, String projectIdentifier, String token) {
        String apiUrl = String.format("%s/api/v4/projects/%s/repository/branches?per_page=100",
                apiBaseUrl, projectIdentifier);
        log.info("[GitLab客户端] 请求URL: {}", apiUrl);

        String responseBody = executeGet(apiUrl, token, "获取分支列表");
        JSONArray branches = JSON.parseArray(StrUtil.blankToDefault(responseBody, "[]"));

        List<BranchInfo> result = new ArrayList<>();
        for (int i = 0; i < branches.size(); i++) {
            JSONObject branch = branches.getJSONObject(i);
            String name = branch.getString("name");
            if (StrUtil.isNotBlank(name)) {
                boolean isDefault = Boolean.TRUE.equals(branch.getBoolean("default"));
                result.add(new BranchInfo(name, isDefault));
            }
        }

        log.info("[GitLab客户端] 获取分支列表成功，数量: {}", result.size());
        return result;
    }

    private void appendBranchIfMissing(GitCommit commit, String branchName) {
        if (commit == null || StrUtil.isBlank(branchName)) {
            return;
        }

        String currentBranch = StrUtil.blankToDefault(commit.getBranch(), "");
        if (StrUtil.isBlank(currentBranch)) {
            commit.setBranch(branchName);
            return;
        }

        List<String> branches = StrUtil.split(currentBranch, ',');
        if (branches != null) {
            for (String branch : branches) {
                if (branchName.equals(StrUtil.trim(branch))) {
                    return;
                }
            }
        }
        commit.setBranch(currentBranch + "," + branchName);
    }

    private List<GitCommit> doGetCommits(String apiBaseUrl, String projectIdentifier, String token, String branch) {
        String encodedBranch = URLEncoder.encode(branch, StandardCharsets.UTF_8);

        String apiUrl = String.format("%s/api/v4/projects/%s/repository/commits?ref_name=%s&per_page=100",
                apiBaseUrl, projectIdentifier, encodedBranch);

        log.info("[GitLab客户端] 请求URL: {}", apiUrl);

        String responseBody = executeGet(apiUrl, token, "获取提交记录");
        log.info("[GitLab客户端] 响应内容: {}",
                responseBody.length() > 500 ? responseBody.substring(0, 500) + "..." : responseBody);

        JSONArray commits = JSON.parseArray(StrUtil.blankToDefault(responseBody, "[]"));

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
    }

    private List<GitCommit> doGetCommitsByTimeRange(String apiBaseUrl, String projectIdentifier, String token,
                                                    String branch, String sinceStr, String untilStr) {
        String encodedBranch = URLEncoder.encode(branch, StandardCharsets.UTF_8);

        String apiUrl = String.format("%s/api/v4/projects/%s/repository/commits?ref_name=%s&since=%s&until=%s&per_page=100",
                apiBaseUrl, projectIdentifier, encodedBranch, sinceStr, untilStr);

        log.info("[GitLab客户端] 请求URL: {}", apiUrl);

        String responseBody = executeGet(apiUrl, token, "获取时间范围内提交记录");
        JSONArray commits = JSON.parseArray(StrUtil.blankToDefault(responseBody, "[]"));

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
    }

    private String executeGet(String apiUrl, String token, String scene) {
        Request request = buildGetRequest(apiUrl, token);

        try (Response response = httpClient.newCall(request).execute()) {
            String responseBody = response.body() != null ? response.body().string() : "";
            if (!response.isSuccessful()) {
                log.error("[GitLab客户端] {}失败，状态码: {}, 响应: {}", scene, response.code(), responseBody);
                throw buildGitLabApiException(response.code(), responseBody);
            }
            return responseBody;
        } catch (IOException e) {
            log.error("[GitLab客户端] {}请求异常，URL: {}", scene, apiUrl, e);
            throw new BusinessException(500, "GitLab API请求异常: " + e.getMessage());
        }
    }

    private Request buildGetRequest(String apiUrl, String token) {
        return new Request.Builder()
                .url(apiUrl)
                .header("PRIVATE-TOKEN", token)
                .header("User-Agent", USER_AGENT)
                .get()
                .build();
    }

    private BusinessException buildGitLabApiException(int httpCode, String errorBody) {
        String reason = extractGitLabErrorReason(errorBody);

        String message;
        switch (httpCode) {
            case 401:
                message = "GitLab Token 无效或已过期";
                break;
            case 403:
                message = "GitLab Token 无权限访问该项目（请确认 token scope: read_api/api，并确保对项目有访问权限）";
                break;
            case 404:
                message = "GitLab 项目不存在或无权限（请核对 projectId/仓库URL）";
                break;
            case 429:
                message = "GitLab API 请求过于频繁，请稍后重试";
                break;
            default:
                message = "GitLab API请求失败: " + httpCode;
                break;
        }

        if (StrUtil.isNotBlank(reason) && !message.contains(reason)) {
            message = message + ": " + reason;
        }

        int bizCode = httpCode;
        if (bizCode < 400 || bizCode > 599) {
            bizCode = 500;
        }
        return new BusinessException(bizCode, message);
    }

    private String extractGitLabErrorReason(String errorBody) {
        if (StrUtil.isBlank(errorBody)) {
            return "";
        }

        try {
            JSONObject obj = JSON.parseObject(errorBody);
            Object message = obj.get("message");
            if (message != null) {
                return message.toString();
            }
            String errorDesc = obj.getString("error_description");
            if (StrUtil.isNotBlank(errorDesc)) {
                return errorDesc;
            }
            String error = obj.getString("error");
            if (StrUtil.isNotBlank(error)) {
                return error;
            }
        } catch (Exception ignored) {
            // 忽略解析异常，走兜底
        }

        String trimmed = errorBody.trim();
        if (trimmed.length() > 200) {
            return trimmed.substring(0, 200) + "...";
        }
        return trimmed;
    }

    private boolean shouldRetryWithProjectPath(BusinessException e, Integer projectId) {
        if (projectId == null || projectId <= 0) {
            return false;
        }
        return e.getCode() != null && (e.getCode() == 403 || e.getCode() == 404);
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
