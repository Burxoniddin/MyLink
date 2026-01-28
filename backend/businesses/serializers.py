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
    logo = serializers.SerializerMethodField()
    logo_upload = serializers.ImageField(write_only=True, required=False, source='logo')
    logo_remove = serializers.BooleanField(write_only=True, required=False, default=False)
    
    class Meta:
        model = Business
        fields = ['id', 'path', 'name', 'description', 'logo', 'logo_upload', 'logo_remove', 'created_at', 'links']
    
    def get_logo(self, obj):
        """Return absolute URL for logo"""
        if obj.logo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.logo.url)
            return obj.logo.url
        return None
        
    def create(self, validated_data):
        validated_data.pop('logo_remove', None)  # logo_remove create-da kerak emas
        links_data = validated_data.pop('links', [])
        user = self.context['request'].user
        business = Business.objects.create(owner=user, **validated_data)
        for link_data in links_data:
            Link.objects.create(business=business, **link_data)
        return business

    def update(self, instance, validated_data):
        links_data = validated_data.pop('links', None)
        logo_remove = validated_data.pop('logo_remove', False)
        
        instance.path = validated_data.get('path', instance.path)
        instance.name = validated_data.get('name', instance.name)
        instance.description = validated_data.get('description', instance.description)
        
        # Logo o'chirish yoki yangilash
        if logo_remove:
            # Eski logo faylini o'chirish
            if instance.logo:
                instance.logo.delete(save=False)
            instance.logo = None
        elif 'logo' in validated_data:
            instance.logo = validated_data.get('logo')
        
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
