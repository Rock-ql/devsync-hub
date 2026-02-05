package com.devsync.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.devsync.entity.Requirement;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

/**
 * 需求 Mapper
 *
 * @author xiaolei
 */
@Mapper
public interface RequirementMapper extends BaseMapper<Requirement> {

    /**
     * 统计迭代下需求数量
     *
     * @param iterationId 迭代ID
     * @return 需求数量
     */
    @Select("SELECT COUNT(*) FROM requirement WHERE iteration_id = #{iterationId} AND deleted_at IS NULL")
    Integer countByIterationId(Integer iterationId);
}
