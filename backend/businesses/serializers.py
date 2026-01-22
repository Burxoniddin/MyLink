from rest_framework import serializers
from .models import Business, Link

class LinkSerializer(serializers.ModelSerializer):
    # Use CharField instead of URLField to allow tel: and mailto: links
    url = serializers.CharField(max_length=500)
    
    class Meta:
        model = Link
        fields = ['id', 'title', 'url', 'icon_type', 'order']

class BusinessSerializer(serializers.ModelSerializer):
    links = LinkSerializer(many=True, required=False)
    
    class Meta:
        model = Business
        fields = ['id', 'path', 'name', 'description', 'logo', 'created_at', 'links']
        
    def create(self, validated_data):
        links_data = validated_data.pop('links', [])
        user = self.context['request'].user
        business = Business.objects.create(owner=user, **validated_data)
        for link_data in links_data:
            Link.objects.create(business=business, **link_data)
        return business

    def update(self, instance, validated_data):
        links_data = validated_data.pop('links', None)
        
        instance.path = validated_data.get('path', instance.path)
        instance.name = validated_data.get('name', instance.name)
        instance.description = validated_data.get('description', instance.description)
        instance.logo = validated_data.get('logo', instance.logo)
        instance.save()
        
        if links_data is not None:
            # Simple strategy: delete old links and create new ones, or update existing.
            # For simplicity in "Save" action, wiping and recreating is easiest but loses IDs.
            # Better: Update if ID present, create if not.
            # But "links" in validated_data won't have IDs if validation stripped them or if they are just data.
            # Let's delete all and recreate for "save" functionality unless we want to keep stats etc.
            instance.links.all().delete()
            for link_data in links_data:
                Link.objects.create(business=instance, **link_data)
                
        return instance
