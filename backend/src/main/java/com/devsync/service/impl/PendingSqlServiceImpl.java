package com.devsync.service.impl;

import cn.hutool.core.bean.BeanUtil;
import cn.hutool.core.util.StrUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.devsync.common.enums.SqlExecutionStatusEnum;
import com.devsync.common.enums.SqlStatusEnum;
import com.devsync.common.exception.BusinessException;
import com.devsync.common.result.PageResult;
import com.devsync.common.util.SqlExecutionStatusHelper;
import com.devsync.dto.req.*;
import com.devsync.dto.rsp.PendingSqlEnvExecutionRsp;
import com.devsync.dto.rsp.PendingSqlRsp;
import com.devsync.dto.rsp.SqlEnvConfigRsp;
import com.devsync.entity.Iteration;
import com.devsync.entity.PendingSql;
import com.devsync.entity.Project;
import com.devsync.entity.SqlExecutionLog;
import com.devsync.mapper.IterationMapper;
import com.devsync.mapper.PendingSqlMapper;
import com.devsync.mapper.ProjectMapper;
import com.devsync.service.IPendingSqlService;
import com.devsync.service.ISqlEnvConfigService;
import com.devsync.service.ISqlExecutionLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 待执行SQL服务实现
 *
 * @author xiaolei
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PendingSqlServiceImpl extends ServiceImpl<PendingSqlMapper, PendingSql> implements IPendingSqlService {

    private final PendingSqlMapper pendingSqlMapper;
    private final ProjectMapper projectMapper;
    private final IterationMapper iterationMapper;
    private final ISqlEnvConfigService sqlEnvConfigService;
    private final ISqlExecutionLogService sqlExecutionLogService;

    @Override
    public PageResult<PendingSqlRsp> listSql(PendingSqlListReq req) {
        log.info("[SQL管理] 分页查询SQL列表，参数: projectId={}, iterationId={}, status={}",
                req.getProjectId(), req.getIterationId(), req.getStatus());

        LambdaQueryWrapper<PendingSql> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(req.getProjectId() != null, PendingSql::getProjectId, req.getProjectId())
                .eq(req.getIterationId() != null, PendingSql::getIterationId, req.getIterationId())
                .like(StrUtil.isNotBlank(req.getTitle()), PendingSql::getTitle, req.getTitle())
                .orderByAsc(PendingSql::getExecutionOrder)
                .orderByDesc(PendingSql::getCreatedAt);

        if (StrUtil.isNotBlank(req.getStatus())) {
            List<PendingSql> records = pendingSqlMapper.selectList(wrapper);
            List<PendingSqlRsp> list = buildEnvExecution(records);
            String normalized = normalizeStatus(req.getStatus());
            List<PendingSqlRsp> filtered = list.stream()
                    .filter(item -> normalized.equals(item.getStatus()))
                    .toList();
            return slicePage(filtered, req.getPageNum(), req.getPageSize());
        }

        Page<PendingSql> page = new Page<>(req.getPageNum(), req.getPageSize());
        Page<PendingSql> result = pendingSqlMapper.selectPage(page, wrapper);

        List<PendingSqlRsp> list = buildEnvExecution(result.getRecords());

        return PageResult.of(list, result.getTotal(), result.getCurrent(), result.getSize());
    }

    @Override
    public PendingSqlRsp getSqlDetail(Integer id) {
        log.info("[SQL管理] 获取SQL详情，ID: {}", id);

        PendingSql sql = pendingSqlMapper.selectById(id);
        if (sql == null) {
            throw new BusinessException(404, "SQL不存在");
        }

        List<PendingSqlRsp> list = buildEnvExecution(List.of(sql));
        return list.isEmpty() ? null : list.get(0);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Integer addSql(PendingSqlAddReq req) {
        log.info("[SQL管理] 新增SQL，项目ID: {}, 标题: {}", req.getProjectId(), req.getTitle());

        // 验证项目是否存在
        Project project = projectMapper.selectById(req.getProjectId());
        if (project == null) {
            throw new BusinessException(404, "项目不存在");
        }

        // 验证迭代是否存在
        if (req.getIterationId() != null) {
            Iteration iteration = iterationMapper.selectById(req.getIterationId());
            if (iteration == null) {
                throw new BusinessException(404, "迭代不存在");
            }
        }

        PendingSql sql = new PendingSql();
        BeanUtil.copyProperties(req, sql);

        // 默认状态为待执行
        sql.setStatus(SqlStatusEnum.PENDING.getCode());

        // 自动设置执行顺序
        if (sql.getExecutionOrder() == null || sql.getExecutionOrder() == 0) {
            sql.setExecutionOrder(pendingSqlMapper.getNextExecutionOrder(req.getProjectId()));
        }

        pendingSqlMapper.insert(sql);
        log.info("[SQL管理] 新增SQL成功，ID: {}", sql.getId());

        return sql.getId();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void updateSql(PendingSqlUpdateReq req) {
        log.info("[SQL管理] 更新SQL，ID: {}", req.getId());

        PendingSql sql = pendingSqlMapper.selectById(req.getId());
        if (sql == null) {
            throw new BusinessException(404, "SQL不存在");
        }

        // 验证迭代是否存在
        if (req.getIterationId() != null) {
            Iteration iteration = iterationMapper.selectById(req.getIterationId());
            if (iteration == null) {
                throw new BusinessException(404, "迭代不存在");
            }
            sql.setIterationId(req.getIterationId());
        }

        // 更新非空字段
        if (StrUtil.isNotBlank(req.getTitle())) {
            sql.setTitle(req.getTitle());
        }
        if (StrUtil.isNotBlank(req.getContent())) {
            sql.setContent(req.getContent());
        }
        if (req.getExecutionOrder() != null) {
            sql.setExecutionOrder(req.getExecutionOrder());
        }
        if (req.getRemark() != null) {
            sql.setRemark(req.getRemark());
        }

        pendingSqlMapper.updateById(sql);
        log.info("[SQL管理] 更新SQL成功，ID: {}", req.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteSql(Integer id) {
        log.info("[SQL管理] 删除SQL，ID: {}", id);

        PendingSql sql = pendingSqlMapper.selectById(id);
        if (sql == null) {
            throw new BusinessException(404, "SQL不存在");
        }

        pendingSqlMapper.deleteById(id);
        log.info("[SQL管理] 删除SQL成功，ID: {}", id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void executeSql(PendingSqlExecuteReq req) {
        log.info("[SQL管理] 标记SQL为已执行，ID: {}, 环境: {}", req.getId(), req.getExecutedEnv());

        PendingSql sql = pendingSqlMapper.selectById(req.getId());
        if (sql == null) {
            throw new BusinessException(404, "SQL不存在");
        }

        String envCode = normalizeEnv(sql.getProjectId(), req.getExecutedEnv());
        sqlExecutionLogService.createLog(sql.getId(), envCode, req.getExecutor(), req.getRemark());
        log.info("[SQL管理] 标记SQL为已执行成功，ID: {}, 环境: {}", req.getId(), envCode);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void batchExecuteSql(PendingSqlBatchExecuteReq req) {
        log.info("[SQL管理] 批量标记SQL为已执行，IDs: {}, 环境: {}", req.getIds(), req.getExecutedEnv());

        for (Integer id : req.getIds()) {
            PendingSql sql = pendingSqlMapper.selectById(id);
            if (sql == null) {
                log.warn("[SQL管理] SQL不存在，跳过: {}", id);
                continue;
            }

            String envCode = normalizeEnv(sql.getProjectId(), req.getExecutedEnv());
            try {
                sqlExecutionLogService.createLog(sql.getId(), envCode, null, null);
            } catch (BusinessException ex) {
                log.warn("[SQL管理] SQL已执行，跳过: {}", id);
            }
        }

        log.info("[SQL管理] 批量标记SQL为已执行成功，数量: {}", req.getIds().size());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void revokeExecution(SqlExecutionRevokeReq req) {
        log.info("[SQL管理] 撤销SQL执行，SQL ID: {}, 环境: {}", req.getSqlId(), req.getEnv());
        sqlExecutionLogService.revokeLog(req.getSqlId(), req.getEnv());
    }

    @Override
    public List<PendingSqlRsp> listPendingByProject(Integer projectId) {
        log.info("[SQL管理] 获取项目的待执行SQL列表，项目ID: {}", projectId);

        LambdaQueryWrapper<PendingSql> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(PendingSql::getProjectId, projectId)
                .orderByAsc(PendingSql::getExecutionOrder);

        List<PendingSqlRsp> list = buildEnvExecution(pendingSqlMapper.selectList(wrapper));
        return list.stream()
                .filter(item -> SqlExecutionStatusEnum.PENDING.getCode().equals(item.getStatus()))
                .collect(Collectors.toList());
    }

    private List<PendingSqlRsp> buildEnvExecution(List<PendingSql> records) {
        if (records.isEmpty()) {
            return List.of();
        }
        List<Integer> sqlIds = records.stream()
                .map(PendingSql::getId)
                .toList();
        Map<Integer, List<SqlExecutionLog>> logsBySql = sqlExecutionLogService.listBySqlIds(sqlIds).stream()
                .collect(Collectors.groupingBy(SqlExecutionLog::getSqlId));

        List<Integer> projectIds = records.stream()
                .map(PendingSql::getProjectId)
                .distinct()
                .toList();
        Map<Integer, List<SqlEnvConfigRsp>> envByProject =
                sqlEnvConfigService.listByProjectIds(projectIds);

        return records.stream()
                .map(sql -> convertToRsp(sql, envByProject, logsBySql))
                .toList();
    }

    /**
     * 转换为响应对象
     */
    private PendingSqlRsp convertToRsp(PendingSql sql,
                                       Map<Integer, List<SqlEnvConfigRsp>> envByProject,
                                       Map<Integer, List<SqlExecutionLog>> logsBySql) {
        PendingSqlRsp rsp = new PendingSqlRsp();
        BeanUtil.copyProperties(sql, rsp);

        // 获取项目名称
        Project project = projectMapper.selectById(sql.getProjectId());
        if (project != null) {
            rsp.setProjectName(project.getName());
        }

        // 获取迭代名称
        if (sql.getIterationId() != null) {
            Iteration iteration = iterationMapper.selectById(sql.getIterationId());
            if (iteration != null) {
                rsp.setIterationName(iteration.getName());
            }
        }

        List<SqlEnvConfigRsp> envs = envByProject.getOrDefault(sql.getProjectId(), List.of());
        Map<String, SqlExecutionLog> logByEnv = logsBySql.getOrDefault(sql.getId(), List.of()).stream()
                .collect(Collectors.toMap(SqlExecutionLog::getEnv, log -> log, (a, b) -> a));

        List<PendingSqlEnvExecutionRsp> envExecutionList = new ArrayList<>();
        int executedCount = 0;
        for (SqlEnvConfigRsp env : envs) {
            SqlExecutionLog logEntity = logByEnv.get(env.getEnvCode());
            PendingSqlEnvExecutionRsp envRsp = new PendingSqlEnvExecutionRsp();
            envRsp.setEnvCode(env.getEnvCode());
            envRsp.setEnvName(env.getEnvName());
            envRsp.setExecuted(logEntity != null);
            if (logEntity != null) {
                envRsp.setExecutedAt(logEntity.getExecutedAt());
                envRsp.setExecutor(logEntity.getExecutor());
                envRsp.setRemark(logEntity.getRemark());
                executedCount++;
            }
            envExecutionList.add(envRsp);
        }

        rsp.setEnvExecutionList(envExecutionList);
        rsp.setExecutedCount(executedCount);
        rsp.setEnvTotal(envs.size());

        SqlExecutionStatusEnum statusEnum = SqlExecutionStatusHelper.calculate(executedCount, envs.size());
        rsp.setStatus(statusEnum.getCode());
        rsp.setStatusDesc(statusEnum.getDesc());

        logsBySql.getOrDefault(sql.getId(), List.of()).stream()
                .max(Comparator.comparing(SqlExecutionLog::getExecutedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .ifPresentOrElse(latest -> {
                    rsp.setExecutedAt(latest.getExecutedAt());
                    rsp.setExecutedEnv(latest.getEnv());
                }, () -> {
                    rsp.setExecutedAt(null);
                    rsp.setExecutedEnv("");
                });

        return rsp;
    }

    private String normalizeStatus(String status) {
        if (StrUtil.isBlank(status)) {
            return status;
        }
        String normalized = status.trim().toLowerCase();
        if (SqlStatusEnum.EXECUTED.getCode().equals(normalized)) {
            return SqlExecutionStatusEnum.COMPLETED.getCode();
        }
        if (SqlStatusEnum.PENDING.getCode().equals(normalized)) {
            return SqlExecutionStatusEnum.PENDING.getCode();
        }
        return normalized;
    }

    private PageResult<PendingSqlRsp> slicePage(List<PendingSqlRsp> list, Integer pageNum, Integer pageSize) {
        int current = pageNum == null || pageNum <= 0 ? 1 : pageNum;
        int size = pageSize == null || pageSize <= 0 ? 20 : pageSize;
        int fromIndex = Math.min((current - 1) * size, list.size());
        int toIndex = Math.min(fromIndex + size, list.size());
        List<PendingSqlRsp> pageList = list.subList(fromIndex, toIndex);
        return PageResult.of(pageList, (long) list.size(), (long) current, (long) size);
    }

    private String normalizeEnv(Integer projectId, String envCode) {
        if (StrUtil.isBlank(envCode)) {
            throw new BusinessException(400, "执行环境不能为空");
        }
        String normalized = envCode.trim().toLowerCase();
        boolean exists = sqlEnvConfigService.listByProjectId(projectId).stream()
                .anyMatch(env -> normalized.equals(env.getEnvCode()));
        if (!exists) {
            throw new BusinessException(400, "环境不存在，请先添加环境");
        }
        return normalized;
    }
}
