package com.devsync.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.devsync.entity.Iteration;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

/**
 * 迭代 Mapper
 *
 * @author xiaolei
 */
@Mapper
public interface IterationMapper extends BaseMapper<Iteration> {

    /**
     * 统计项目的迭代数量
     *
     * @param projectId 项目ID
     * @return 迭代数量
     */
    @Select("SELECT COUNT(DISTINCT i.id) " +
            "FROM iteration i " +
            "LEFT JOIN iteration_project ip ON ip.iteration_id = i.id AND ip.deleted_at IS NULL " +
            "WHERE i.deleted_at IS NULL AND (i.project_id = #{projectId} OR ip.project_id = #{projectId})")
    Integer countByProjectId(Integer projectId);
}
