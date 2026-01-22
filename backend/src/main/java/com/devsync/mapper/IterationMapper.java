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
    @Select("SELECT COUNT(*) FROM iteration WHERE project_id = #{projectId} AND deleted_at IS NULL")
    Integer countByProjectId(Integer projectId);
}
