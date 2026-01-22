package com.devsync.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.devsync.entity.PendingSql;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

/**
 * 待执行SQL Mapper
 *
 * @author xiaolei
 */
@Mapper
public interface PendingSqlMapper extends BaseMapper<PendingSql> {

    /**
     * 统计项目的待执行SQL数量
     *
     * @param projectId 项目ID
     * @return 待执行SQL数量
     */
    @Select("SELECT COUNT(*) FROM pending_sql WHERE project_id = #{projectId} AND status = 'pending' AND deleted_at IS NULL")
    Integer countPendingByProjectId(Integer projectId);

    /**
     * 统计迭代的待执行SQL数量
     *
     * @param iterationId 迭代ID
     * @return 待执行SQL数量
     */
    @Select("SELECT COUNT(*) FROM pending_sql WHERE iteration_id = #{iterationId} AND status = 'pending' AND deleted_at IS NULL")
    Integer countPendingByIterationId(Integer iterationId);

    /**
     * 获取项目的下一个执行顺序号
     *
     * @param projectId 项目ID
     * @return 下一个执行顺序号
     */
    @Select("SELECT COALESCE(MAX(execution_order), 0) + 1 FROM pending_sql WHERE project_id = #{projectId} AND deleted_at IS NULL")
    Integer getNextExecutionOrder(Integer projectId);
}
