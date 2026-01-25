package com.devsync.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.devsync.common.exception.BusinessException;
import com.devsync.entity.SqlExecutionLog;
import com.devsync.mapper.SqlExecutionCount;
import com.devsync.mapper.SqlExecutionLogMapper;
import com.devsync.service.ISqlExecutionLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * SQL执行记录服务实现
 *
 * @author xiaolei
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SqlExecutionLogServiceImpl extends ServiceImpl<SqlExecutionLogMapper, SqlExecutionLog>
        implements ISqlExecutionLogService {

    private final SqlExecutionLogMapper sqlExecutionLogMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void createLog(Integer sqlId, String env, String executor, String remark) {
        LambdaQueryWrapper<SqlExecutionLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SqlExecutionLog::getSqlId, sqlId)
                .eq(SqlExecutionLog::getEnv, env);
        if (sqlExecutionLogMapper.selectCount(wrapper) > 0) {
            throw new BusinessException(400, "该环境已执行");
        }

        SqlExecutionLog logEntity = new SqlExecutionLog();
        logEntity.setSqlId(sqlId);
        logEntity.setEnv(env);
        logEntity.setExecutor(executor == null ? "" : executor);
        logEntity.setRemark(remark == null ? "" : remark);
        logEntity.setExecutedAt(LocalDateTime.now());
        sqlExecutionLogMapper.insert(logEntity);

        log.info("[SQL执行] 记录执行成功，sqlId={}, env={}", sqlId, env);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void revokeLog(Integer sqlId, String env) {
        SqlExecutionLog logEntity = sqlExecutionLogMapper.selectOne(new LambdaQueryWrapper<SqlExecutionLog>()
                .eq(SqlExecutionLog::getSqlId, sqlId)
                .eq(SqlExecutionLog::getEnv, env));
        if (logEntity == null) {
            throw new BusinessException(404, "执行记录不存在");
        }
        sqlExecutionLogMapper.deleteById(logEntity.getId());

        log.info("[SQL执行] 撤销执行成功，sqlId={}, env={}", sqlId, env);
    }

    @Override
    public List<SqlExecutionLog> listBySqlIds(List<Integer> sqlIds) {
        if (sqlIds == null || sqlIds.isEmpty()) {
            return List.of();
        }
        LambdaQueryWrapper<SqlExecutionLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.in(SqlExecutionLog::getSqlId, sqlIds)
                .orderByDesc(SqlExecutionLog::getExecutedAt);
        return sqlExecutionLogMapper.selectList(wrapper);
    }

    @Override
    public Map<Integer, Long> countExecutedBySqlIds(List<Integer> sqlIds) {
        if (sqlIds == null || sqlIds.isEmpty()) {
            return Map.of();
        }
        return sqlExecutionLogMapper.countBySqlIds(sqlIds).stream()
                .collect(Collectors.toMap(SqlExecutionCount::getSqlId, SqlExecutionCount::getCount));
    }
}
