package com.devsync.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.devsync.entity.WorkItemLink;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

/**
 * 工作项关联 Mapper
 *
 * @author xiaolei
 */
@Mapper
public interface WorkItemLinkMapper extends BaseMapper<WorkItemLink> {

    /**
     * 统计迭代关联的工作项数量
     *
     * @param iterationId 迭代ID
     * @return 工作项数量
     */
    @Select("SELECT COUNT(*) FROM work_item_link WHERE link_type = 'iteration' AND link_id = #{iterationId} AND deleted_at IS NULL")
    Integer countByIterationId(Integer iterationId);

    /**
     * 物理删除需求的关联关系，避免唯一约束冲突
     *
     * @param workItemId 需求ID
     * @return 删除条数
     */
    @Delete("DELETE FROM work_item_link WHERE work_item_id = #{workItemId}")
    int deleteByWorkItemId(Integer workItemId);
}
