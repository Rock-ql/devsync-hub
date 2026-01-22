package com.devsync.service.impl;

import cn.hutool.core.bean.BeanUtil;
import cn.hutool.core.util.StrUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.devsync.common.enums.SqlStatusEnum;
import com.devsync.common.exception.BusinessException;
import com.devsync.common.result.PageResult;
import com.devsync.dto.req.*;
import com.devsync.dto.rsp.PendingSqlRsp;
import com.devsync.entity.Iteration;
import com.devsync.entity.PendingSql;
import com.devsync.entity.Project;
import com.devsync.mapper.IterationMapper;
import com.devsync.mapper.PendingSqlMapper;
import com.devsync.mapper.ProjectMapper;
import com.devsync.service.IPendingSqlService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
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

    @Override
    public PageResult<PendingSqlRsp> listSql(PendingSqlListReq req) {
        log.info("[SQL管理] 分页查询SQL列表，参数: projectId={}, iterationId={}, status={}",
                req.getProjectId(), req.getIterationId(), req.getStatus());

        LambdaQueryWrapper<PendingSql> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(req.getProjectId() != null, PendingSql::getProjectId, req.getProjectId())
                .eq(req.getIterationId() != null, PendingSql::getIterationId, req.getIterationId())
                .like(StrUtil.isNotBlank(req.getTitle()), PendingSql::getTitle, req.getTitle())
                .eq(StrUtil.isNotBlank(req.getStatus()), PendingSql::getStatus, req.getStatus())
                .orderByAsc(PendingSql::getExecutionOrder)
                .orderByDesc(PendingSql::getCreatedAt);

        Page<PendingSql> page = new Page<>(req.getPageNum(), req.getPageSize());
        Page<PendingSql> result = pendingSqlMapper.selectPage(page, wrapper);

        List<PendingSqlRsp> list = result.getRecords().stream()
                .map(this::convertToRsp)
                .collect(Collectors.toList());

        return PageResult.of(list, result.getTotal(), result.getCurrent(), result.getSize());
    }

    @Override
    public PendingSqlRsp getSqlDetail(Integer id) {
        log.info("[SQL管理] 获取SQL详情，ID: {}", id);

        PendingSql sql = pendingSqlMapper.selectById(id);
        if (sql == null) {
            throw new BusinessException(404, "SQL不存在");
        }

        return convertToRsp(sql);
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

        // 已执行的SQL不允许修改
        if (SqlStatusEnum.EXECUTED.getCode().equals(sql.getStatus())) {
            throw new BusinessException(400, "已执行的SQL不允许修改");
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

        if (SqlStatusEnum.EXECUTED.getCode().equals(sql.getStatus())) {
            throw new BusinessException(400, "SQL已执行，请勿重复操作");
        }

        sql.setStatus(SqlStatusEnum.EXECUTED.getCode());
        sql.setExecutedAt(LocalDateTime.now());
        sql.setExecutedEnv(req.getExecutedEnv());

        pendingSqlMapper.updateById(sql);
        log.info("[SQL管理] 标记SQL为已执行成功，ID: {}", req.getId());
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

            if (SqlStatusEnum.EXECUTED.getCode().equals(sql.getStatus())) {
                log.warn("[SQL管理] SQL已执行，跳过: {}", id);
                continue;
            }

            sql.setStatus(SqlStatusEnum.EXECUTED.getCode());
            sql.setExecutedAt(LocalDateTime.now());
            sql.setExecutedEnv(req.getExecutedEnv());
            pendingSqlMapper.updateById(sql);
        }

        log.info("[SQL管理] 批量标记SQL为已执行成功，数量: {}", req.getIds().size());
    }

    @Override
    public List<PendingSqlRsp> listPendingByProject(Integer projectId) {
        log.info("[SQL管理] 获取项目的待执行SQL列表，项目ID: {}", projectId);

        LambdaQueryWrapper<PendingSql> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(PendingSql::getProjectId, projectId)
                .eq(PendingSql::getStatus, SqlStatusEnum.PENDING.getCode())
                .orderByAsc(PendingSql::getExecutionOrder);

        List<PendingSql> list = pendingSqlMapper.selectList(wrapper);
        return list.stream()
                .map(this::convertToRsp)
                .collect(Collectors.toList());
    }

    /**
     * 转换为响应对象
     */
    private PendingSqlRsp convertToRsp(PendingSql sql) {
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

        // 获取状态描述
        SqlStatusEnum statusEnum = SqlStatusEnum.getByCode(sql.getStatus());
        if (statusEnum != null) {
            rsp.setStatusDesc(statusEnum.getDesc());
        }

        return rsp;
    }
}
