def get_tags(photo):
    tags_list = photo['photo']['tags']['tag']
    tags_title_list = []
    for tag in tags_list:
        tags_title_list.append(tag['raw'])
    return ", ".join(tags_title_list)
